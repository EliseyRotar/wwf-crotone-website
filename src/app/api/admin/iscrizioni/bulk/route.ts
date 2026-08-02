import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionUser } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  status: z.enum(["pending", "confirmed", "paid", "cancelled", "waitlist"])
});

function getManagerTurns(session: SessionUser): string[] {
  return session.role === "superadmin"
    ? []
    : (session.assignedTurns ?? "").split(",").filter(Boolean);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!validateOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!(await rateLimit(`bulk-update:${clientKey(req)}`, 5, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const { ids, status } = parsed.data;
  const managerTurns = getManagerTurns(session);

  // Managers can only act on rows in their assigned turns
  const where = session.role !== "superadmin"
    ? { id: { in: ids }, turnoId: { in: managerTurns } }
    : { id: { in: ids } };

  try {
    // C-07: when bulk-cancelling, decrement bookedCount on each affected
    // turno. To keep this correct under concurrency we first fetch the
    // rows that are moving (status != cancelled -> cancelled), then apply
    // both updates inside one transaction.
    const result = await prisma.$transaction(async (tx) => {
      const moving = status === "cancelled"
        ? await tx.iscrizione.findMany({
            where: { ...where, status: { not: "cancelled" } },
            select: { id: true, turnoId: true }
          })
        : [];
      const reanimating = status !== "cancelled"
        ? await tx.iscrizione.findMany({
            where: { ...where, status: "cancelled" },
            select: { id: true, turnoId: true, turno: { select: { capacity: true } } }
          })
        : [];

      const upd = await tx.iscrizione.updateMany({
        where,
        data: { status, managedBy: session.id }
      });

      // Per-turno adjustment: count how many slots are being freed or
      // reclaimed for each turn, then decrement / increment by that count
      // using the same conditional guards as elsewhere.
      const freedByTurno = new Map<string, number>();
      for (const m of moving) {
        freedByTurno.set(m.turnoId, (freedByTurno.get(m.turnoId) ?? 0) + 1);
      }
      for (const [turnoId, n] of freedByTurno) {
        // Best-effort decrement — clamped at 0 by `gt: 0`. If the count
        // somehow overshoots, the next updateMany will simply stop.
        let remaining = n;
        while (remaining > 0) {
          const r = await tx.turno.updateMany({
            where: { id: turnoId, bookedCount: { gt: 0 } },
            data: { bookedCount: { decrement: 1 } }
          });
          if (r.count === 0) break;
          remaining--;
        }
      }

      const reclaimedByTurno = new Map<string, { n: number; capacity: number }>();
      for (const m of reanimating) {
        const cap = m.turno.capacity;
        const prev = reclaimedByTurno.get(m.turnoId);
        if (prev) prev.n += 1;
        else reclaimedByTurno.set(m.turnoId, { n: 1, capacity: cap });
      }
      for (const [turnoId, { n, capacity }] of reclaimedByTurno) {
        for (let i = 0; i < n; i++) {
          const r = await tx.turno.updateMany({
            where: { id: turnoId, bookedCount: { lt: capacity } },
            data: { bookedCount: { increment: 1 } }
          });
          if (r.count === 0) break;
        }
      }

      return upd;
    });

    // Audit trail
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "status_change",
        entity: "iscrizione",
        entityId: null,
        details: JSON.stringify({ ids, status, count: result.count })
      }
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error("bulk update error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
