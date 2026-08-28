import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UpdateTurnoSchema = z
  .object({
    id: z.string().min(1).max(64),
    capacity: z.number().int().positive().max(100_000).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`admin-turni:${clientKey(req)}`, 20, 60000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = UpdateTurnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id, capacity, isActive } = parsed.data;

  const data: { capacity?: number; isActive?: boolean } = {};
  if (capacity !== undefined) data.capacity = capacity;
  if (isActive !== undefined) data.isActive = isActive;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "no-edits" }, { status: 400 });
  }

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
