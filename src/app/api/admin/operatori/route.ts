import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const ROLE_ENUM = ["operatore", "tecnico", "coordinatore", "chef"] as const;
const SEX_ENUM = ["M", "F", "X"] as const;

const CreateOperatoreSchema = z
  .object({
    firstName: z.string().trim().min(1).max(LIMITS.MAX_NAME),
    lastName: z.string().trim().max(LIMITS.MAX_NAME).optional().default(""),
    sex: z.enum(SEX_ENUM).nullable().optional(),
    role: z.enum(ROLE_ENUM).optional().default("operatore"),
    email: z.string().trim().max(LIMITS.MAX_EMAIL).email().nullable().optional(),
    phone: z.string().trim().max(LIMITS.MAX_PHONE).nullable().optional(),
    assignedTurns: z.string().max(2000).nullable().optional(),
    notes: z.string().trim().max(LIMITS.MAX_NOTES).nullable().optional()
  })
  .strict();

const UpdateOperatoreSchema = z
  .object({
    id: z.string().min(1).max(64),
    firstName: z.string().trim().min(1).max(LIMITS.MAX_NAME).optional(),
    lastName: z.string().trim().max(LIMITS.MAX_NAME).optional(),
    sex: z.enum(SEX_ENUM).nullable().optional(),
    role: z.enum(ROLE_ENUM).optional(),
    email: z.string().trim().max(LIMITS.MAX_EMAIL).email().nullable().optional(),
    phone: z.string().trim().max(LIMITS.MAX_PHONE).nullable().optional(),
    assignedTurns: z.string().max(2000).nullable().optional(),
    notes: z.string().trim().max(LIMITS.MAX_NOTES).nullable().optional()
  })
  .strict();

const DeleteOperatoreSchema = z
  .object({
    id: z.string().min(1).max(64)
  })
  .strict();

async function requireSuperadmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  if (session.role !== "superadmin") {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function readJson(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`admin-op:${clientKey(req)}`, 20, 60000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = CreateOperatoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { firstName, lastName, sex, role, email, phone, assignedTurns, notes } = parsed.data;

  await prisma.operatore.create({
    data: {
      firstName,
      lastName,
      sex: sex ?? null,
      role,
      email: email ?? null,
      phone: phone ?? null,
      assignedTurns: assignedTurns ?? null,
      notes: notes ?? null
    }
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`admin-op:${clientKey(req)}`, 20, 60000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = UpdateOperatoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id, firstName, lastName, sex, role, email, phone, assignedTurns, notes } = parsed.data;

  const existing = await prisma.operatore.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  await prisma.operatore.update({
    where: { id },
    data: {
      firstName: firstName ?? existing.firstName,
      lastName: lastName ?? existing.lastName,
      sex: sex !== undefined ? sex : existing.sex,
      role: role ?? existing.role,
      email: email !== undefined ? email : existing.email,
      phone: phone !== undefined ? phone : existing.phone,
      assignedTurns: assignedTurns !== undefined ? assignedTurns : existing.assignedTurns,
      notes: notes !== undefined ? notes : existing.notes
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`admin-op:${clientKey(req)}`, 10, 60000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = DeleteOperatoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id } = parsed.data;
  await prisma.operatore.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  return PUT(req);
}
