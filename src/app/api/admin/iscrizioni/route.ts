import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id, status, notes, feePaid, balancePaid } = await req.json();
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    const valid = ["pending", "confirmed", "paid", "cancelled", "waitlist"];
    if (status && !valid.includes(status)) {
      return NextResponse.json({ ok: false, error: "invalid-status" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findUnique({
      where: { id },
      include: { turno: { select: { capacity: true } } }
    });
    if (!iscrizione) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    if (!canAccessTurn(session, iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const data: {
      status?: string;
      notes?: string;
      feePaid?: boolean;
      feePaidDate?: Date | null;
      balancePaid?: boolean;
      balancePaidDate?: Date | null;
      managedBy?: string;
    } = {};
    if (status) data.status = status;
    if (notes !== undefined) data.notes = String(notes).slice(0, 5000);
    if (feePaid !== undefined) {
      data.feePaid = feePaid;
      data.feePaidDate = feePaid ? new Date() : null;
    }
    if (balancePaid !== undefined) {
      data.balancePaid = balancePaid;
      data.balancePaidDate = balancePaid ? new Date() : null;
    }
    data.managedBy = session.id;

    // C-07: if the new status is "cancelled" and the prior status was NOT
    // cancelled, decrement the turno's bookedCount so the freed slot becomes
    // available again. If the status was already cancelled, do not
    // double-decrement. If we're moving FROM "cancelled" to something active,
    // re-increment with the same capacity guard.
    const wasActive = iscrizione.status !== "cancelled";
    const goingToCancelled = data.status === "cancelled";

    await prisma.$transaction(async (tx) => {
      await tx.iscrizione.update({ where: { id }, data });

      if (goingToCancelled && wasActive) {
        // Decrement — never below 0 (clamp with a single SQL guard).
        await tx.turno.updateMany({
          where: { id: iscrizione.turnoId, bookedCount: { gt: 0 } },
          data: { bookedCount: { decrement: 1 } }
        });
      } else if (!goingToCancelled && !wasActive) {
        // Re-activating a previously cancelled record: try to claim a slot
        // back, but never exceed capacity.
        await tx.turno.updateMany({
          where: {
            id: iscrizione.turnoId,
            bookedCount: { lt: iscrizione.turno.capacity ?? Number.MAX_SAFE_INTEGER }
          },
          data: { bookedCount: { increment: 1 } }
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: "status_change",
      entity: "iscrizione",
      entityId: id,
      details: JSON.stringify(data)
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("iscrizione PATCH error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    if (session.role !== "superadmin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    const existing = await prisma.iscrizione.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

    // C-07: deletion is the same as a cancel — free up the slot, but only
    // if the row counted (i.e. it wasn't already cancelled).
    const wasActive = existing.status !== "cancelled";
    await prisma.$transaction(async (tx) => {
      await tx.iscrizione.delete({ where: { id } });
      if (wasActive) {
        await tx.turno.updateMany({
          where: { id: existing.turnoId, bookedCount: { gt: 0 } },
          data: { bookedCount: { decrement: 1 } }
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: "delete",
      entity: "iscrizione",
      entityId: id
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("iscrizione DELETE error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
