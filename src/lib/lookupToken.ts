/**
 * HMAC-signed, single-purpose token used by the volunteer "mio-iscrizione"
 * page to retrieve their own registration without an account.
 *
 * Token shape: `<base64url(id)>.<expiryMs>.<base64urlHmac>`
 * Verified with AUTH_SECRET. Expires after 30 days.
 *
 * Why not just embed the id in plain text? A bare id would let anyone with
 * a guessed cuid see another volunteer's status. The HMAC prevents forgery;
 * the id itself is meaningless without the secret, so a leaked id alone is
 * useless. The base64url wrap around the id guards against collisions with
 * the `.` token separator (cuids are alphanumeric, but defending against
 * future schema changes is cheap).
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/auth";

const COOKIE = "wwf_lookup";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return getAuthSecret();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function encodePart(s: string): string {
  return b64url(Buffer.from(s, "utf8"));
}

function decodePart(s: string): string {
  return fromB64url(s).toString("utf8");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payload).digest());
}

/**
 * Mint a token for the given iscrizione id. Valid for 30 days.
 */
export function signLookupToken(iscrizioneId: string): string {
  const expiry = Date.now() + MAX_AGE_MS;
  const payload = `${encodePart(iscrizioneId)}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a token. Returns the iscrizione id if valid and unexpired,
 * otherwise null. Uses a constant-time comparison to avoid timing leaks.
 */
export function verifyLookupToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedId, expiryStr, providedSig] = parts;
  if (!encodedId || !expiryStr || !providedSig) return null;

  let provided: Buffer;
  let expected: Buffer;
  let id: string;
  try {
    id = decodePart(encodedId);
    provided = fromB64url(providedSig);
    expected = Buffer.from(sign(`${encodedId}.${expiryStr}`), "base64");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;
  return id;
}

export const LOOKUP_COOKIE_NAME = COOKIE;
export const LOOKUP_COOKIE_MAX_AGE_S = Math.floor(MAX_AGE_MS / 1000);
