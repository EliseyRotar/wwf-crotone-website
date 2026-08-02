import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { clearAccountCookies, ACCOUNT_COOKIE_NAME } from "@/lib/accountSession";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/logout
 *
 * Clears both the short-lived account cookie and the long-lived device
 * cookie, and removes the matching DeviceSession row (if any) so a
 * stolen-cookie attacker can't continue to ride the persisted device
 * after the user has explicitly logged out.
 *
 * Body: optional { locale } — used to redirect to the locale-correct
 *       login page. The response is always JSON so the client can
 *       navigate the user after the call.
 */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`acct-logout:${clientKey(req)}`, 20, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // Best-effort parse — body is optional
    let locale: "it" | "en" = "it";
    try {
      const body = (await req.json()) as { locale?: string } | null;
      if (body && (body.locale === "it" || body.locale === "en")) {
        locale = body.locale;
      }
    } catch {
      // No JSON body is fine.
    }

    // Pull device-hash from the cookie (if present) so we can find
    // and delete the matching DeviceSession row.
    const store = await cookies();
    const shortId = verifyShortCookieForLogout(store.get(ACCOUNT_COOKIE_NAME)?.value);
    const deviceCookie = store.get("wwf_device_session")?.value;

    await clearAccountCookies();

    if (shortId) {
      // Best-effort: drop the device-session row tied to this user.
      try {
        await prisma.deviceSession.deleteMany({ where: { userId: shortId } });
      } catch {
        // ignore
      }
    }
    if (deviceCookie) {
      // Also try to clear any orphan device-session row (matching user
      // not found in short cookie path).
      try {
        const parts = deviceCookie.split(".");
        if (parts.length === 4) {
          const id = decodeB64url(parts[0]);
          if (id) {
            await prisma.deviceSession.deleteMany({ where: { userId: id } });
          }
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ ok: true, locale });
  } catch (err) {
    console.error("logout error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

function verifyShortCookieForLogout(cookieValue: string | undefined): string | null {
  // We re-implement a small subset of verifyAccountCookie here to
  // avoid pulling the entire session helper (which also reads the
  // database). For logout we only need the userId out of the cookie.
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  try {
    return decodeB64url(parts[0]);
  } catch {
    return null;
  }
}

function decodeB64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}
