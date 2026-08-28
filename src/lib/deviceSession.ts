/**
 * Phase 1: "remember this device" cookie for the volunteer personal area.
 *
 * The cookie is a self-contained, HMAC-signed token so the server can
 * recognize the device without an extra round-trip to the DB. We also
 * persist a `DeviceSession` row keyed on (userId, deviceHash) so we can
 * revoke a device, list active devices, and audit the last-seen
 * IP / UA. The cookie is bound to:
 *
 *   - the userId of the Iscrizione
 *   - a deviceHash derived from the caller's UA + Accept-Language + a
 *     server secret, so a stolen cookie does not work from a different
 *     browser fingerprint
 *   - the expiry timestamp
 *
 * Cookie format: `<base64url(userId)>.<base64url(deviceHash)>.<expiryMs>.<base64urlHmac>`
 *
 * All comparisons use a constant-time HMAC compare to avoid timing
 * leaks. The secret is reused from AUTH_SECRET via the shared
 * getAuthSecret() in auth.ts so there is one source of truth. Tests
 * must set AUTH_SECRET to a 32+ char value via vitest.setup.ts.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/auth";

export const DEVICE_COOKIE_NAME = "wwf_device_session";
export const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const DEVICE_TTL_S = Math.floor(DEVICE_TTL_MS / 1000);

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
 * Compute a stable hash for the caller's browser. Mixes UA +
 * Accept-Language and the server secret so a cookie stolen to a
 * different browser fingerprint is rejected.
 */
export function deviceHashFor(ua: string, acceptLanguage: string): string {
  const h = createHmac("sha256", getSecret());
  h.update(ua || "");
  h.update("\n");
  h.update(acceptLanguage || "");
  return b64url(h.digest());
}

export type MintDeviceCookieOpts = {
  userId: string;
  ua: string;
  acceptLanguage: string;
  /** Optional override; defaults to now + 30 days. */
  expiresAtMs?: number;
};

export type MintedDeviceCookie = {
  value: string;
  expiresAt: Date;
  deviceHash: string;
};

/**
 * Mint a signed cookie value. Also returns the deviceHash and expiry
 * so the caller can persist a DeviceSession row in the same flow.
 */
export function mintDeviceCookie(opts: MintDeviceCookieOpts): MintedDeviceCookie {
  const expiresAtMs = opts.expiresAtMs ?? Date.now() + DEVICE_TTL_MS;
  const deviceHash = deviceHashFor(opts.ua, opts.acceptLanguage);
  const payload = `${encodePart(opts.userId)}.${encodePart(deviceHash)}.${expiresAtMs}`;
  const value = `${payload}.${sign(payload)}`;
  return { value, expiresAt: new Date(expiresAtMs), deviceHash };
}

export type VerifyDeviceCookieResult =
  | { ok: true; userId: string; deviceHash: string; expiresAtMs: number }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" | "device-mismatch" };

/**
 * Verify a device cookie. Returns the userId on success or a tagged
 * reason on failure. Always checks the deviceHash against the current
 * request's fingerprint so a stolen cookie doesn't work from a
 * different browser.
 */
export function verifyDeviceCookie(
  cookieValue: string | undefined | null,
  currentUa: string,
  currentAcceptLanguage: string
): VerifyDeviceCookieResult {
  if (!cookieValue || typeof cookieValue !== "string") {
    return { ok: false, reason: "malformed" };
  }
  const parts = cookieValue.split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const [encodedId, encodedHash, expiryStr, providedSig] = parts;
  if (!encodedId || !encodedHash || !expiryStr || !providedSig) {
    return { ok: false, reason: "malformed" };
  }

  let userId: string;
  let deviceHash: string;
  let provided: Buffer;
  let expected: Buffer;
  try {
    userId = decodePart(encodedId);
    deviceHash = decodePart(encodedHash);
    provided = fromB64url(providedSig);
    expected = Buffer.from(sign(`${encodedId}.${encodedHash}.${expiryStr}`), "base64");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (provided.length !== expected.length) {
    return { ok: false, reason: "bad-signature" };
  }
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const currentHash = deviceHashFor(currentUa, currentAcceptLanguage);
  // Constant-time compare on the decoded hash bytes
  const a = Buffer.from(deviceHash);
  const b = Buffer.from(currentHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "device-mismatch" };
  }

  return { ok: true, userId, deviceHash, expiresAtMs: expiry };
}
