import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["operatore", "tecnico", "coordinatore", "chef"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, sex, role, email, phone, assignedTurns, notes } = body;

  if (!firstName) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "invalid-role" }, { status: 400 });
  }

  await prisma.operatore.create({
    data: {
      firstName,
      lastName: lastName || "",
      sex: sex || null,
      role: role || "operatore",
      email: email || null,
      phone: phone || null,
      assignedTurns: assignedTurns || null,
      notes: notes || null
    }
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, firstName, lastName, sex, role, email, phone, assignedTurns, notes } = body;

  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "invalid-role" }, { status: 400 });
  }

  const existing = await prisma.operatore.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  await prisma.operatore.update({
    where: { id },
    data: {
      firstName: firstName ?? existing.firstName,
      lastName: lastName ?? existing.lastName,
      sex: sex !== undefined ? (sex || null) : existing.sex,
      role: role ?? existing.role,
      email: email !== undefined ? (email || null) : existing.email,
      phone: phone !== undefined ? (phone || null) : existing.phone,
      assignedTurns: assignedTurns !== undefined ? (assignedTurns || null) : existing.assignedTurns,
      notes: notes !== undefined ? (notes || null) : existing.notes
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
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
  await prisma.operatore.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  return PUT(req);
}
