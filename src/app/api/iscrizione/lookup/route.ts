import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const code = searchParams.get("code");

  if (!email) return NextResponse.json({ ok: false, error: "missing-email" }, { status: 400 });

  // Simple lookup: find iscrizione by email, return status
  const iscrizioni = await prisma.iscrizione.findMany({
    where: { email: email.toLowerCase(), status: { notIn: ["cancelled"] } },
    include: { turno: true, receipts: true },
    orderBy: { turno: { number: "asc" } }
  });

  if (iscrizioni.length === 0)
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    iscrizioni: iscrizioni.map((i) => ({
      id: i.id,
      firstName: i.firstName,
      lastName: i.lastName,
      isMinor: i.isMinor,
      status: i.status,
      feePaid: i.feePaid,
      balancePaid: i.balancePaid,
      turnoNumber: i.turno.number,
      turnoStart: i.turno.startDate.toISOString(),
      turnoEnd: i.turno.endDate.toISOString(),
      dietaryNeeds: i.dietaryNeeds,
      tshirtSize: i.tshirtSize,
      arrivalMode: i.arrivalMode,
      arrivalTime: i.arrivalTime,
      departureTime: i.departureTime,
      hasReceipt: i.receipts.length > 0,
      receiptUrl: i.receipts[0]?.filePath ?? null
    }))
  });
}