import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { setAccountCookie } from "@/lib/accountSession";
import { consumeVerificationToken, advanceStatus } from "@/lib/userFlow";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  token: z.string().min(8).max(512),
  locale: z.enum(["it", "en"]).default("it")
});

/**
 * GET /api/account/verify-email?token=...&locale=it
 *
 * Consumes the email-verification token (single-use, 24h expiry) and
 * advances the Iscrizione from "pending" → "email_verified". Then:
 *
 *   1. Sets a 24h account cookie so the user lands logged in.
 *   2. 302-redirects to /account/bookings/<id>/receipts (the next
 *      step in their flow).
 *
 * If the token is invalid or already used, redirects to /account/verify
 * so the existing page can render a friendly error.
 *
 * Why a Route Handler and not a Server Action? Because we're handling
 * an email link (initial GET, no form submission). Server Actions can't
 * be triggered by a plain URL.
 */
export async function GET(req: Request) {
  const locale = (new URL(req.url).searchParams.get("locale") ?? "it") === "en" ? "en" : "it";
  try {
    if (!(await rateLimit(`verify:${clientKey(req)}`, 10, 900_000))) {
      return redirectTo(`/${locale}/account/verify`, { error: "rate-limited" }, req);
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      token: url.searchParams.get("token") ?? "",
      locale: url.searchParams.get("locale") ?? "it"
    });
    if (!parsed.success) {
      return redirectTo(`/${locale}/account/verify`, { error: "invalid" }, req);
    }
    const { token } = parsed.data;

    // Look up the iscrizione BEFORE consuming the token so we know
    // whether to redirect to /receipts or /account.
    const tokenHash = createHash("sha256").update(token).digest("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const candidate = await prisma.iscrizioneVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        iscrizione: { select: { id: true, status: true } }
      }
    });

    if (!candidate || candidate.expiresAt.getTime() < Date.now()) {
      return redirectTo(`/${locale}/account/verify`, { error: "invalid-or-expired", token }, req);
    }

    // Already verified → just log them in and send to /account
    if (
      candidate.iscrizione.status === "email_verified" ||
      candidate.iscrizione.status === "receipt_uploaded" ||
      candidate.iscrizione.status === "confirmed" ||
      candidate.iscrizione.status === "paid"
    ) {
      try {
        await setAccountCookie(candidate.iscrizione.id);
      } catch (err) {
        console.error("[verify-email] setAccountCookie (already-verified) failed:", err);
      }
      return redirectTo(`/${locale}/account`, { verified: "already" }, req);
    }

    // First-time verify → consume token, advance status, log in,
    // redirect to receipts page.
    const iscrizioneId = await consumeVerificationToken(token, "email_verified");
    if (!iscrizioneId || iscrizioneId !== candidate.iscrizione.id) {
      return redirectTo(`/${locale}/account/verify`, { error: "invalid-or-expired", token }, req);
    }

    const updated = await advanceStatus(candidate.iscrizione.id, "email_verified", {
      skipNotification: false
    });
    if (!updated) {
      return redirectTo(`/${locale}/account/verify`, { error: "server" }, req);
    }

    try {
      await setAccountCookie(updated.id);
    } catch (err) {
      console.error("[verify-email] setAccountCookie failed:", err);
      // Non-fatal: user can still sign in via the magic link.
    }

    return redirectTo(`/${locale}/account/bookings/${updated.id}/receipts`, {}, req);
  } catch (err) {
    console.error("verify-email GET error:", err);
    return redirectTo(`/${locale}/account/verify`, { error: "server" }, req);
  }
}

function redirectTo(path: string, params: Record<string, string>, req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
  const qs = new URLSearchParams(params).toString();
  const dest = `${base}${path}${qs ? `?${qs}` : ""}`;
  return NextResponse.redirect(dest, { status: 303 });
}
