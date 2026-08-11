import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import {
  consumeVerificationToken,
  advanceStatus
} from "@/lib/userFlow";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(8).max(512)
});

/**
 * POST /api/iscrizione/[id]/verify-email
 *
 * Body: { token }
 * Response: { ok, status, iscrizioneId } | { ok: false, error }
 *
 * Consumes the IscrizioneVerificationToken for this Iscrizione,
 * verifies it authorises "email_verified" (the next step in the
 * lifecycle), then advances the Iscrizione's status from "pending"
 * to "email_verified" and stamps emailVerifiedAt.
 *
 * The token is single-use: consumeVerificationToken uses updateMany
 * with consumedAt: null in the WHERE so a parallel redeem loses the
 * race cleanly.
 *
 * Note: we do NOT require the caller's session — the magic link is
 * delivered by email, so the typical client is a freshly-registered
 * volunteer who has not yet logged in. We do still rate-limit + CSRF
 * to prevent spray and CSRF.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`verify:${clientKey(req)}`, 10, 900_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }

    // Look the Iscrizione up first so we can scope the token to it
    // (avoids replaying a token minted for a different Iscrizione).
    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    // Defensive: if the Iscrizione is already past email_verified, we
    // still let the redeem succeed (idempotent). The advanceStatus
    // call is a no-op for same-status, and consumeVerificationToken
    // will still mark the token consumed.
    const iscrizioneIdFromToken = await consumeVerificationToken(
      parsed.data.token,
      "email_verified"
    );
    if (!iscrizioneIdFromToken) {
      return NextResponse.json(
        { ok: false, error: "invalid-or-expired-token" },
        { status: 400 }
      );
    }
    if (iscrizioneIdFromToken !== iscrizione.id) {
      // Token belongs to a different Iscrizione. Don't leak which.
      return NextResponse.json(
        { ok: false, error: "invalid-or-expired-token" },
        { status: 400 }
      );
    }

    const updated = await advanceStatus(iscrizione.id, "email_verified", {
      skipNotification: false
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      iscrizioneId: updated.id,
      status: updated.status
    });
  } catch (err) {
    console.error("verify-email POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
