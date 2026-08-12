/**
 * Phase 1: volunteer session helpers for the personal area.
 *
 * The volunteer "account" is an Iscrizione. We do NOT mint a JWT
 * (avoids the per-request DB hit that admin auth pays); instead we
 * sign an httpOnly cookie carrying the Iscrizione.id, bound to:
 *   - the cookie's HMAC (so it can't be forged)
 *   - a deviceHash (so a stolen cookie doesn't work from a different
 *     browser fingerprint; see src/lib/deviceSession.ts)
 *
 * Two cookie shapes:
 *   - Short-lived (24h, `wwf_account`): set after a magic-link
 *     redemption, when the user did NOT tick "remember this device".
 *   - Long-lived (30 days, `wwf_device_session`): set when they did.
 *     Bound to the same deviceHash persisted in `DeviceSession` so we
 *     can revoke the device from the admin panel later.
 *
 * `getAccountSession()` consults both cookies in order:
 *   1. Long-lived device cookie (also re-validates the DeviceSession
 *      row so revoked devices stop working immediately).
 *   2. Short-lived account cookie.
 *
 * If neither is present or valid, returns null. We never throw from
 * this function — UI code treats it as "logged out".
 */

import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  verifyDeviceCookie,
  DEVICE_COOKIE_NAME,
  type VerifyDeviceCookieResult
} from "@/lib/deviceSession";

export const ACCOUNT_COOKIE_NAME = "wwf_account";
export const ACCOUNT_TTL_S = 24 * 60 * 60; // 24 hours

function getSecret(): string {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or too short. Generate one with: openssl rand -base64 48"
    );
  }
  return raw;
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

export type AccountSession = {
  iscrizioneId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** True when this is from a 30-day device cookie, false when from a 24h cookie. */
  persistent: boolean;
  /** When present, the DeviceSession row id (only for the long-lived path). */
  deviceSessionId?: string;
};

/**
 * Mint a short-lived 24h account cookie. Payload: <encodedId>.<expiryMs>.<hmac>.
 */
export function signAccountCookie(
  iscrizioneId: string,
  expiresAtMs: number = Date.now() + ACCOUNT_TTL_S * 1000
): string {
  const payload = `${encodePart(iscrizioneId)}.${expiresAtMs}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a short-lived 24h account cookie. Returns the Iscrizione.id
 * on success, null on any failure (malformed / bad signature / expired).
 */
export function verifyAccountCookie(cookieValue: string | undefined | null): string | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const parts = cookieValue.split(".");
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

/**
 * Set the short-lived account cookie on the response. The caller is
 * expected to already be inside a Server Action / Route Handler where
 * `cookies()` is writable.
 */
export async function setAccountCookie(iscrizioneId: string) {
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  store.set(ACCOUNT_COOKIE_NAME, signAccountCookie(iscrizioneId), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCOUNT_TTL_S
  });
}

/**
 * Set the long-lived device cookie. The cookie's value comes from
 * `mintDeviceCookie`; we also persist a DeviceSession row so the
 * server can revoke the device later.
 */
export async function setDeviceSessionCookie(opts: {
  iscrizioneId: string;
  deviceHash: string;
  cookieValue: string;
  expiresAt: Date;
  ip: string | null;
  ua: string;
}) {
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  store.set(DEVICE_COOKIE_NAME, opts.cookieValue, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.floor((opts.expiresAt.getTime() - Date.now()) / 1000))
  });

  // Upsert the device-session row keyed on (userId, deviceHash). If the
  // same device re-visits we just refresh lastSeenAt and the IP/UA.
  try {
    await prisma.deviceSession.upsert({
      where: {
        userId_deviceHash: {
          userId: opts.iscrizioneId,
          deviceHash: opts.deviceHash
        }
      },
      update: {
        lastSeenAt: new Date(),
        expiresAt: opts.expiresAt,
        ipAddress: opts.ip,
        userAgent: opts.ua.slice(0, 256)
      },
      create: {
        userId: opts.iscrizioneId,
        deviceHash: opts.deviceHash,
        expiresAt: opts.expiresAt,
        ipAddress: opts.ip,
        userAgent: opts.ua.slice(0, 256)
      }
    });
  } catch {
    // Never break login on a device-session persistence failure.
  }
}

/**
 * Clear both account and device cookies. Idempotent.
 */
export async function clearAccountCookies() {
  const store = await cookies();
  store.delete(ACCOUNT_COOKIE_NAME);
  store.delete(DEVICE_COOKIE_NAME);
}

/**
 * Resolve the current volunteer session, if any. Returns null on any
 * failure (cookie missing, signature mismatch, DB row gone, soft-
 * deleted). Refuses to throw — callers treat null as "logged out".
 *
 * If `req` is omitted, we read UA + accept-language from `next/headers`
 * so the device-cookie fingerprint check works in Server Components
 * (which is how every page in /account calls us).
 */
export async function getAccountSession(req?: {
  ua: string;
  acceptLanguage: string;
}): Promise<AccountSession | null> {
  const store = await cookies();
  const deviceCookie = store.get(DEVICE_COOKIE_NAME)?.value;
  const shortCookie = store.get(ACCOUNT_COOKIE_NAME)?.value;

  // 1) Try the long-lived device cookie first.
  if (deviceCookie) {
    let ua = req?.ua ?? "";
    let al = req?.acceptLanguage ?? "";
    if (!req) {
      try {
        const h = await headers();
        ua = h.get("user-agent") ?? "";
        al = h.get("accept-language") ?? "";
      } catch {
        // headers() unavailable in this context — UA stays empty, the
        // fingerprint check fails, and the device cookie is treated as
        // not-current. Better than crashing.
      }
    }
    const result: VerifyDeviceCookieResult = verifyDeviceCookie(deviceCookie, ua, al);
    if (result.ok) {
      const row = await prisma.deviceSession.findUnique({
        where: {
          userId_deviceHash: { userId: result.userId, deviceHash: result.deviceHash }
        }
      });
      if (row && row.expiresAt.getTime() > Date.now()) {
        const isc = await prisma.iscrizione.findUnique({
          where: { id: result.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            deletedAt: true
          }
        });
        if (isc && !isc.deletedAt) {
          // Best-effort lastSeen bump. Don't block on it.
          void prisma.deviceSession
            .update({
              where: { id: row.id },
              data: { lastSeenAt: new Date() }
            })
            .catch(() => undefined);
          return {
            iscrizioneId: isc.id,
            email: isc.email,
            firstName: isc.firstName,
            lastName: isc.lastName,
            persistent: true,
            deviceSessionId: row.id
          };
        }
      }
    }
  }

  // 2) Fall back to the short-lived cookie.
  if (shortCookie) {
    const id = verifyAccountCookie(shortCookie);
    if (id) {
      const isc = await prisma.iscrizione.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          deletedAt: true
        }
      });
      if (isc && !isc.deletedAt) {
        return {
          iscrizioneId: isc.id,
          email: isc.email,
          firstName: isc.firstName,
          lastName: isc.lastName,
          persistent: false
        };
      }
    }
  }

  return null;
}
