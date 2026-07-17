import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id, status, notes, feePaid, balancePaid } = await req.json();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }

  const valid = ["pending", "confirmed", "paid", "cancelled", "waitlist"];
  if (status && !valid.includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid-status" }, { status: 400 });
  }

  const iscrizione = await prisma.iscrizione.findUnique({ where: { id } });
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
  if (notes !== undefined) data.notes = notes;
  if (feePaid !== undefined) {
    data.feePaid = feePaid;
    data.feePaidDate = feePaid ? new Date() : null;
  }
  if (balancePaid !== undefined) {
    data.balancePaid = balancePaid;
    data.balancePaidDate = balancePaid ? new Date() : null;
  }
  data.managedBy = session.id;

  await prisma.iscrizione.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  await prisma.iscrizione.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}