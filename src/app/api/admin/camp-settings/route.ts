import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const settings = await prisma.campSettings.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`admin-cs:${clientKey(req)}`, 10, 60000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await req.json();
  const { year, startDate, endDate, numTurns, turnDurationDays, costNonMember, costMember, minorInsurance, registrationFee, iban, isActive } = body;

  const existing = await prisma.campSettings.findFirst({ orderBy: { createdAt: "desc" } });
  const data = {
    year: Number(year) || 2026,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    numTurns: Number(numTurns) || 12,
    turnDurationDays: Number(turnDurationDays) || 7,
    costNonMember: Number(costNonMember) || 430,
    costMember: Number(costMember) || 400,
    minorInsurance: Number(minorInsurance) || 20,
    registrationFee: Number(registrationFee) || 100,
    iban: iban || null,
    isActive: isActive ?? true
  };

  if (existing) {
    await prisma.campSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.campSettings.create({ data });
  }
  return NextResponse.json({ ok: true });
}
