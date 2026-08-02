import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id, capacity, isActive } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  const data: { capacity?: number; isActive?: boolean } = {};
  if (typeof capacity === "number" && capacity > 0) data.capacity = capacity;
  if (typeof isActive === "boolean") data.isActive = isActive;
  await prisma.turno.update({ where: { id }, data });
  await logAudit({
    userId: session.id,
    action: "update",
    entity: "turno",
    entityId: id,
    details: JSON.stringify(data)
  });
  return NextResponse.json({ ok: true });
}
