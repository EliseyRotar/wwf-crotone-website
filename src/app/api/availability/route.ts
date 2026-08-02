import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * F1: Public, read-only availability counter.
 * Returns booked / capacity for every active turn so the dates page can poll
 * without reloading.
 */
export async function GET() {
  try {
    // C-07: source of truth is now Turno.bookedCount, maintained atomically
    // by the create / cancel paths. We keep the legacy groupBy as a sanity
    // check (debug only) but the `booked` value below is bookedCount.
    const turni = await prisma.turno.findMany({
      where: { isActive: true },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        capacity: true,
        startDate: true,
        endDate: true,
        bookedCount: true
      }
    });

    const turnIds = turni.map((t) => t.id);
    const counts = await prisma.iscrizione.groupBy({
      by: ["turnoId"],
      where: { turnoId: { in: turnIds }, status: { notIn: ["cancelled"] } },
      _count: { id: true }
    });
    const countMap = new Map(counts.map((c) => [c.turnoId, c._count.id]));

    const now = Date.now();
    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      turni: turni.map((t) => {
        // C-07: prefer the atomic counter; if it has drifted from reality
        // (e.g. legacy data), the countMap below self-heals on next read.
        const fromCounter = t.bookedCount ?? 0;
        const fromReality = countMap.get(t.id) ?? 0;
        const booked = Math.max(fromCounter, fromReality);
        const remaining = Math.max(0, t.capacity - booked);
        const isPast = t.endDate.getTime() < now;
        return {
          id: t.id,
          number: t.number,
          capacity: t.capacity,
          booked,
          remaining,
          isPast
        };
      })
    });
  } catch (err) {
    console.error("availability error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
