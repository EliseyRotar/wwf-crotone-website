/**
 * HMAC-signed tokens used by the newsletter unsubscribe flow.
 *
 * Token shape: `<base64url(email)>.<expiryMs>.<base64urlHmac>`
 * Verified with AUTH_SECRET. Expires after 90 days.
 *
 * The token is embedded directly in the URL the user clicks from the
 * email — there is no account system and no inbox round-trip. The HMAC
 * prevents trivially unsubscribing arbitrary addresses.
 *
 * The email portion is base64url-encoded to avoid any ambiguity with the
 * `.` separator between payload segments (emails contain `.`).
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/auth";

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

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
 * Mint an unsubscribe token for the given email. Caller is responsible
 * for URL-encoding the result before placing it in an HTML email.
 */
export function signNewsletterToken(email: string): string {
  const expiry = Date.now() + MAX_AGE_MS;
  const payload = `${encodePart(email.toLowerCase())}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a token. Returns the email if valid + unexpired, else null.
 */
export function verifyNewsletterToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedEmail, expiryStr, providedSig] = parts;
  if (!encodedEmail || !expiryStr || !providedSig) return null;

  let provided: Buffer;
  let expected: Buffer;
  let email: string;
  try {
    email = decodePart(encodedEmail);
    if (!email.includes("@")) return null;
    provided = fromB64url(providedSig);
    expected = Buffer.from(sign(`${encodedEmail}.${expiryStr}`), "base64");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  return email;
}
