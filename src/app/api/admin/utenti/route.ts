import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { email, name, password, role, assignedTurns } = await req.json();
  if (!email || !password) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ ok: false, error: "exists" }, { status: 400 });
  const hash = await bcrypt.hash(password, 12);

  // Calculate expiry: the end date of the latest assigned turn + 7 days grace
  let expiresAt: Date | null = null;
  if (role !== "superadmin" && assignedTurns) {
    const turnIds = assignedTurns.split(",").filter(Boolean);
    if (turnIds.length > 0) {
      const turni = await prisma.turno.findMany({
        where: { id: { in: turnIds } },
        orderBy: { endDate: "desc" },
        take: 1
      });
      if (turni.length > 0) {
        expiresAt = new Date(turni[0].endDate.getTime() + 7 * 24 * 3600 * 1000);
      }
    }
  }

  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash: hash,
      role: role === "superadmin" ? "superadmin" : "manager",
      assignedTurns: assignedTurns ?? null,
      expiresAt
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  if (id === session.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}