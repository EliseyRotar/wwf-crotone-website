import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountSession } from "@/lib/accountSession";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/booking/[id]/history
 *
 * Returns the audit-log rows for the booking as JSON. The volunteer
 * timeline page (booking/[id]/history) is a server-rendered page that
 * fetches these rows directly via prisma — this endpoint exists so a
 * future client-side refresh path can poll for new changes without a
 * full reload.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`acct-hist:${clientKey(req)}`, 30, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const session = await getAccountSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    if (
      iscrizione.id !== session.iscrizioneId &&
      iscrizione.email.toLowerCase() !== session.email.toLowerCase()
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const rows = await prisma.auditLog.findMany({
      where: { entity: "iscrizione", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return NextResponse.json({
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        action: r.action,
        fieldName: r.fieldName,
        oldValue: r.oldValue,
        newValue: r.newValue,
        details: r.details,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString()
      }))
    });
  } catch (err) {
    console.error("history GET error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
