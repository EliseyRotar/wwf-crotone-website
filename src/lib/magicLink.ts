/**
 * Phase 1: Magic-link tokens for the volunteer personal area.
 *
 * Flow:
 *   1. POST /api/account/magic-link receives an email, finds a matching
 *      Iscrizione, mints a fresh token, stores ONLY its SHA-256 hash
 *      (the raw token is delivered by email and is never persisted),
 *      and emails the link.
 *   2. The volunteer clicks the link → GET /api/account/redeem?token=...
 *      The route hashes the inbound token, looks it up, marks it
 *      consumed, and issues a session cookie.
 *
 * Security notes:
 *   - We never store the raw token — only the hash. A DB leak does not
 *     let the attacker log in as any user.
 *   - We use the Web Crypto API (`crypto.subtle.digest`) so this code
 *     works in both the Node runtime and the edge runtime.
 *   - Tokens are single-use: `consumedAt` is set on first successful
 *     redemption, and the redeem route refuses to honour a token that
 *     already has a `consumedAt`.
 *   - 30-minute expiry. We sweep old tokens lazily on every request
 *     (deleteMany where expiresAt < now) so the table does not grow
 *     unbounded.
 */

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * SHA-256 the token, base64url-encode the digest. Works in Node 18+ and
 * the edge runtime. Returns the encoded hash suitable for DB lookup.
 */
export async function hashMagicToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64urlFromBytes(new Uint8Array(digest));
}

/**
 * Generate a fresh, URL-safe, cryptographically random token. 32 random
 * bytes (256 bits) of entropy, base64url-encoded → ~43 chars.
 */
export function mintRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64urlFromBytes(bytes);
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Pull the caller's IP and UA, truncated to safe sizes. We never persist
 * the raw headers in full — UA gets capped to 256 chars (same as the
 * newsletter handler), and we only keep the IP we already trust via
 * `clientKey`.
 */
async function safeReqContext(): Promise<{ ip: string | null; ua: string }> {
  try {
    const h = await headers();
    const ua = (h.get("user-agent") ?? "").slice(0, 256);
    const trusted = process.env.TRUSTED_PROXY_HEADER?.toLowerCase();
    const prod = process.env.NODE_ENV === "production";
    let ip: string | null = null;
    if (prod && trusted) {
      const v = h.get(trusted);
      if (v) ip = v.split(",")[0].trim() || null;
    } else if (!prod) {
      const xff = h.get("x-forwarded-for");
      if (xff) ip = xff.split(",")[0].trim() || null;
    }
    return { ip, ua };
  } catch {
    return { ip: null, ua: "" };
  }
}

/**
 * Mint a magic link for the given email and return the raw token (the
 * caller will email it). Returns null when the email does not match an
 * Iscrizione — the caller is expected to NOT differentiate the two
 * cases from the public API to avoid enumeration.
 */
export async function generateMagicLink(
  email: string
): Promise<{ rawToken: string; expiresAt: Date } | null> {
  const lower = email.trim().toLowerCase();
  const iscrizione = await prisma.iscrizione.findFirst({
    where: { email: lower, deletedAt: null },
    select: { id: true, email: true }
  });
  if (!iscrizione) return null;

  // Lazy GC: keep the table small. Best-effort — never throw.
  try {
    await prisma.magicLink.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });
  } catch {
    // ignore
  }

  const rawToken = mintRawToken();
  const tokenHash = await hashMagicToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
  const ctx = await safeReqContext();

  await prisma.magicLink.create({
    data: {
      email: lower,
      tokenHash,
      expiresAt,
      ipAddress: ctx.ip,
      userAgent: ctx.ua
    }
  });

  return { rawToken, expiresAt };
}

/**
 * Redeem a raw token. Returns the email on success, or null on any
 * failure (unknown / expired / already consumed). Always stamps
 * `consumedAt` on success, so the row cannot be replayed.
 */
export async function consumeMagicLink(
  rawToken: string
): Promise<{ email: string } | null> {
  if (!rawToken || typeof rawToken !== "string") return null;
  const tokenHash = await hashMagicToken(rawToken);
  const now = new Date();
  const row = await prisma.magicLink.findUnique({ where: { tokenHash } });
  if (!row) return null;
  if (row.consumedAt) return null; // already used
  if (row.expiresAt.getTime() < now.getTime()) return null;

  // Update lastSeenAt and consumedAt atomically. We use updateMany so we
  // don't throw on a parallel redemption (the second caller will see
  // count === 0 and we report null).
  const update = await prisma.magicLink.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now }
  });
  if (update.count === 0) return null;

  return { email: row.email };
}

/**
 * Build the redeem URL. Accepts the active locale so the volunteer
 * lands on a page in the language they were browsing in.
 *
 * The link points at the API route (`/api/account/redeem`) because
 * that route is the one that consumes the token and sets the session
 * cookie. It then issues a 303 redirect to the locale-prefixed
 * `/account` page.
 */
export function buildMagicLinkUrl(
  rawToken: string,
  locale: "it" | "en" = "it"
): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // We strip a trailing slash on `base` to avoid `//` in the path.
  const safeBase = base.replace(/\/+$/, "");
  return `${safeBase}/api/account/redeem?token=${encodeURIComponent(rawToken)}&locale=${locale}`;
}
