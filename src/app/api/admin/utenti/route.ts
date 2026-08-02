import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateEmail, LIMITS } from "@/lib/validate";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`utenti:${clientKey(req)}`, 5, 900_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { email, name, password, role, assignedTurns } = await req.json();
  if (!email || !password) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  if (!validateEmail(email)) return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ ok: false, error: "password-too-short" }, { status: 400 });
  }
  if (name && typeof name === "string" && name.length > LIMITS.MAX_NAME) {
    return NextResponse.json({ ok: false, error: "name-too-long" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const hash = await bcrypt.hash(password, 12);

  let expiresAt: Date | null = null;
  if (role !== "superadmin" && assignedTurns) {
    const turnIds = assignedTurns.split(",").filter(Boolean);
    if (turnIds.length > 0) {
      const turni = await prisma.turno.findMany({
        where: { id: { in: turnIds } },
        orderBy: { endDate: "desc" },
        take: 1,
        select: { endDate: true }
      });
      if (turni.length > 0) {
        expiresAt = new Date(turni[0].endDate.getTime() + 7 * 24 * 3600 * 1000);
      }
    }
  }

  const created = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash: hash,
      role: role === "superadmin" ? "superadmin" : "manager",
      assignedTurns: assignedTurns ?? null,
      expiresAt
    }
  });
  await logAudit({
    userId: session.id,
    action: "create",
    entity: "user",
    entityId: created.id,
    details: JSON.stringify({ email: created.email, role: created.role })
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  if (id === session.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  await logAudit({
    userId: session.id,
    action: "delete",
    entity: "user",
    entityId: id
  });
  return NextResponse.json({ ok: true });
}
