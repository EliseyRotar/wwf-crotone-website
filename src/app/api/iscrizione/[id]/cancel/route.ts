import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { advanceStatus } from "@/lib/userFlow";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Free-form reason, stored on the AuditLog details. */
  reason: z.string().max(500).optional()
});

/**
 * POST /api/iscrizione/[id]/cancel
 *
 * Admin-only. Sets Iscrizione.status = "cancelled" and stamps
 * cancelledAt. Idempotent — cancelling an already-cancelled row is a
 * no-op that still returns 200.
 *
 * Per-turn access for managers: managers can only cancel turns in
 * their assignedTurns. Superadmins always pass.
 *
 * Note: this route does NOT refund or release the bookedCount — the
 * admin must do that from the panel if appropriate. We only flip the
 * status; the lifecycle timestamp is the source of truth.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (!(await rateLimit(`cancel:${clientKey(req)}`, 30, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, turnoId: true }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    if (!canAccessTurn(session, iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const updated = await advanceStatus(iscrizione.id, "cancelled", {
      actorId: session.id,
      // Surface the free-form reason on the audit row.
      data: parsed.data.reason ? { notes: parsed.data.reason } : undefined,
      ip: clientKey(req),
      ua: req.headers.get("user-agent")
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      iscrizioneId: updated.id,
      status: updated.status,
      cancelledAt: updated.cancelledAt
    });
  } catch (err) {
    console.error("cancel POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
