import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { advanceStatus, computeEditsLockedAt } from "@/lib/userFlow";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Optional override for the lock timestamp. Admin only. */
  editsLockedAt: z.string().datetime().optional()
});

/**
 * POST /api/iscrizione/[id]/confirm
 *
 * Admin-only. Sets Iscrizione.status = "confirmed", stamps
 * confirmedAt, and (lazily) sets editsLockedAt to turno.startDate -
 * 7 days if that date has already passed. The volunteer can no
 * longer edit their panel once this returns.
 *
 * Per-turn access for managers: a manager can only confirm
 * registrations on turns in their assignedTurns CSV. Superadmins
 * always pass.
 *
 * Notifies the admin team (the same status-change mail sent by
 * advanceStatus) and writes a coarse "status_change" audit log.
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
    if (!(await rateLimit(`confirm:${clientKey(req)}`, 30, 60_000))) {
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
      select: {
        id: true,
        status: true,
        turnoId: true,
        editsLockedAt: true,
        turno: { select: { startDate: true, number: true } }
      }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    if (!canAccessTurn(session, iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (iscrizione.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "cancelled" }, { status: 409 });
    }

    // Lazy lock: stamp editsLockedAt = turno.startDate - 7d if the
    // window has already passed. If the admin sent an override,
    // honour it.
    const now = new Date();
    const autoLock = computeEditsLockedAt(iscrizione.turno.startDate, now);
    const lockAt = parsed.data.editsLockedAt
      ? new Date(parsed.data.editsLockedAt)
      : (autoLock ?? iscrizione.editsLockedAt ?? null);

    const updated = await advanceStatus(iscrizione.id, "confirmed", {
      actorId: session.id,
      data: lockAt ? { editsLockedAt: lockAt } : undefined,
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
      confirmedAt: updated.confirmedAt,
      editsLockedAt: updated.editsLockedAt
    });
  } catch (err) {
    console.error("confirm POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
