import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const CampSettingsSchema = z
  .object({
    year: z.coerce.number().int().min(2020).max(2100),
    startDate: z.string().min(8).max(40),
    endDate: z.string().min(8).max(40),
    numTurns: z.coerce.number().int().min(1).max(52),
    turnDurationDays: z.coerce.number().int().min(1).max(30),
    costNonMember: z.coerce.number().int().min(0).max(10000),
    costMember: z.coerce.number().int().min(0).max(10000),
    minorInsurance: z.coerce.number().int().min(0).max(10000),
    registrationFee: z.coerce.number().int().min(0).max(10000),
    iban: z.string().max(64).optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = CampSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const v = parsed.data;

  const start = new Date(v.startDate);
  const end = new Date(v.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid-date" }, { status: 400 });
  }
  if (end.getTime() < start.getTime()) {
    return NextResponse.json({ ok: false, error: "end-before-start" }, { status: 400 });
  }

  const data = {
    year: v.year,
    startDate: start,
    endDate: end,
    numTurns: v.numTurns,
    turnDurationDays: v.turnDurationDays,
    costNonMember: v.costNonMember,
    costMember: v.costMember,
    minorInsurance: v.minorInsurance,
    registrationFee: v.registrationFee,
    iban: v.iban ?? "",
    isActive: v.isActive,
  };

  const existing = await prisma.campSettings.findFirst({ orderBy: { createdAt: "desc" } });
  if (existing) {
    await prisma.campSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.campSettings.create({ data });
  }
  return NextResponse.json({ ok: true });
}
