import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await rateLimit(`avail:${clientKey(req)}`, 60, 60000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }
  try {
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
