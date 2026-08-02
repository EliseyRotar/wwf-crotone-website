import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { consumeMagicLink } from "@/lib/magicLink";
import { mintDeviceCookie } from "@/lib/deviceSession";
import {
  setAccountCookie,
  setDeviceSessionCookie
} from "@/lib/accountSession";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  token: z.string().min(8).max(512),
  remember: z.enum(["true", "false", "1", "0"]).optional(),
  locale: z.enum(["it", "en"]).default("it")
});

/**
 * GET /api/account/redeem?token=...&remember=true&locale=it
 *
 * Consumes the magic link (single-use, 30-minute expiry) and issues
 * either a short-lived 24h account cookie or a 30-day device cookie
 * depending on the `remember` flag. On success redirects to /account.
 *
 * Failure modes all redirect back to /account/login with a localised
 * error code in the query string — we never render an error JSON
 * inline because the volunteer is following an email link.
 */
export async function GET(req: Request) {
  const locale = (new URL(req.url).searchParams.get("locale") ?? "it") === "en" ? "en" : "it";
  try {
    if (!(await rateLimit(`redeem:${clientKey(req)}`, 10, 900_000))) {
      return redirectTo(`/${locale}/account/login`, { error: "rate-limited" }, req);
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      token: url.searchParams.get("token") ?? "",
      remember: url.searchParams.get("remember") ?? undefined,
      locale: url.searchParams.get("locale") ?? "it"
    });
    if (!parsed.success) {
      return redirectTo(`/${locale}/account/login`, { error: "invalid" }, req);
    }
    const { token, remember } = parsed.data;
    const wantRemember = remember === "true" || remember === "1";

    const consumed = await consumeMagicLink(token);
    if (!consumed) {
      // Either unknown, expired, or already used. We don't differentiate.
      return redirectTo(`/${locale}/account/login`, { error: "invalid-or-expired" }, req);
    }

    // Find the Iscrizione by email. We do this AFTER consuming the
    // token so an attacker can't probe for valid emails.
    const iscrizione = await prisma.iscrizione.findFirst({
      where: { email: consumed.email, deletedAt: null },
      select: { id: true, email: true }
    });
    if (!iscrizione) {
      return redirectTo(`/${locale}/account/login`, { error: "invalid-or-expired" }, req);
    }

    // Set the session cookie. Short-lived by default; long-lived when
    // the user explicitly opted in.
    if (wantRemember) {
      const ua = req.headers.get("user-agent") ?? "";
      const al = req.headers.get("accept-language") ?? "";
      const minted = mintDeviceCookie({
        userId: iscrizione.id,
        ua,
        acceptLanguage: al
      });
      const ip = clientKey(req);
      await setDeviceSessionCookie({
        iscrizioneId: iscrizione.id,
        deviceHash: minted.deviceHash,
        cookieValue: minted.value,
        expiresAt: minted.expiresAt,
        ip,
        ua
      });
    } else {
      await setAccountCookie(iscrizione.id);
    }

    // Best-effort audit log
    void logAudit({
      userId: iscrizione.id, // userId field stores the volunteer's Iscrizione id
      action: "login",
      entity: "iscrizione",
      entityId: iscrizione.id,
      details: JSON.stringify({ method: "magic-link", persistent: wantRemember }),
      ipAddress: clientKey(req),
      userAgent: req.headers.get("user-agent")
    });

    return redirectTo(`/${locale}/account`, {}, req);
  } catch (err) {
    console.error("redeem GET error:", err);
    return redirectTo(`/${locale}/account/login`, { error: "server" }, req);
  }
}

/**
 * Build a 303 See Other redirect back to the public site. We always
 * redirect via the public base URL (NEXT_PUBLIC_SITE_URL) so a
 * proxied /api route can still hand control back to the user-facing
 * app without baking in the wrong scheme.
 */
function redirectTo(path: string, params: Record<string, string>, req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
  const qs = new URLSearchParams(params).toString();
  const dest = `${base}${path}${qs ? `?${qs}` : ""}`;
  return NextResponse.redirect(dest, { status: 303 });
}
