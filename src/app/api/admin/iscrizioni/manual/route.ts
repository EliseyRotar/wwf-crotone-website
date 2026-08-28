import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { getCampStart, calcAge } from "@/lib/turns";
import { sanitizeHtml, LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const CAMP_START_FALLBACK = new Date("2026-06-21");

const SHORT_TEXT = z.string().trim().max(LIMITS.MAX_STRING);
const NULLABLE_SHORT_TEXT = SHORT_TEXT.nullable().optional();
const NULLABLE_LONG_TEXT = z.string().trim().max(LIMITS.MAX_NOTES).nullable().optional();
const NULLABLE_BOOL = z.boolean().nullable().optional();

const CreateManualSchema = z
  .object({
    firstName: z.string().trim().min(1).max(LIMITS.MAX_NAME),
    lastName: z.string().trim().min(1).max(LIMITS.MAX_NAME),
    birthDate: z.string().min(8).max(40),
    email: z.string().trim().toLowerCase().email().max(LIMITS.MAX_EMAIL),
    phone: z.string().trim().min(1).max(LIMITS.MAX_PHONE),
    isMinor: NULLABLE_BOOL,
    guardianName: NULLABLE_SHORT_TEXT,
    guardianEmail: z.string().trim().toLowerCase().email().max(LIMITS.MAX_EMAIL).nullable().optional(),
    guardianPhone: NULLABLE_SHORT_TEXT,
    guardianConsent: NULLABLE_BOOL,
    turnoIds: z.array(z.string().min(1).max(64)).min(1).max(20),
    allergies: NULLABLE_SHORT_TEXT,
    medications: NULLABLE_SHORT_TEXT,
    swimmingAbility: z.enum(["none", "basic", "confident"]).nullable().optional(),
    tetanusStatus: z.enum(["unknown", "vaccinated", "not_vaccinated"]).nullable().optional(),
    fitnessSelf: NULLABLE_SHORT_TEXT,
    dietaryNeeds: z.enum(["none", "vegetarian", "vegan", "celiac", "other"]).nullable().optional(),
    dietaryNotes: NULLABLE_SHORT_TEXT,
    tshirtSize: z.enum(["S", "M", "L", "XL", "XXL"]).nullable().optional(),
    arrivalMode: z
      .enum(["own_car", "train", "bus", "plane_crotone", "plane_lamezia", "need_pickup"])
      .nullable()
      .optional(),
    arrivalTime: NULLABLE_SHORT_TEXT,
    departureTime: NULLABLE_SHORT_TEXT,
    privacyConsent: z.boolean().optional().default(true),
    marketingConsent: NULLABLE_BOOL,
    imageDataConsent: NULLABLE_BOOL,
    feePaid: NULLABLE_BOOL,
    balancePaid: NULLABLE_BOOL,
    notes: NULLABLE_LONG_TEXT,
    status: z.enum([
      "pending",
      "email_verified",
      "receipt_uploaded",
      "confirmed",
      "paid",
      "cancelled",
      "waitlist"
    ]).optional()
  })
  .strict();

const UpdateManualSchema = z
  .object({
    id: z.string().min(1).max(64),
    firstName: SHORT_TEXT.optional(),
    lastName: SHORT_TEXT.optional(),
    email: z.string().trim().toLowerCase().email().max(LIMITS.MAX_EMAIL).optional(),
    phone: SHORT_TEXT.optional(),
    isMinor: z.boolean().optional(),
    guardianName: NULLABLE_SHORT_TEXT,
    guardianEmail: z.string().trim().toLowerCase().email().max(LIMITS.MAX_EMAIL).nullable().optional(),
    guardianPhone: NULLABLE_SHORT_TEXT,
    guardianConsent: z.boolean().optional(),
    birthDate: z.string().min(8).max(40).nullable().optional(),
    allergies: NULLABLE_SHORT_TEXT,
    medications: NULLABLE_SHORT_TEXT,
    swimmingAbility: z.enum(["none", "basic", "confident"]).nullable().optional(),
    tetanusStatus: z.enum(["unknown", "vaccinated", "not_vaccinated"]).nullable().optional(),
    fitnessSelf: NULLABLE_SHORT_TEXT,
    dietaryNeeds: z.enum(["none", "vegetarian", "vegan", "celiac", "other"]).nullable().optional(),
    dietaryNotes: NULLABLE_SHORT_TEXT,
    tshirtSize: z.enum(["S", "M", "L", "XL", "XXL"]).nullable().optional(),
    arrivalMode: z
      .enum(["own_car", "train", "bus", "plane_crotone", "plane_lamezia", "need_pickup"])
      .nullable()
      .optional(),
    arrivalTime: NULLABLE_SHORT_TEXT,
    departureTime: NULLABLE_SHORT_TEXT,
    privacyConsent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
    imageDataConsent: z.boolean().optional(),
    feePaid: z.boolean().optional(),
    balancePaid: z.boolean().optional(),
    notes: z.string().trim().max(LIMITS.MAX_NOTES).optional(),
    status: z
      .enum([
        "pending",
        "email_verified",
        "receipt_uploaded",
        "confirmed",
        "paid",
        "cancelled",
        "waitlist"
      ])
      .optional()
  })
  .strict();

function asDateOr400(value: string, errorKey: string): Date | NextResponse {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return NextResponse.json({ ok: false, error: errorKey }, { status: 400 });
  }
  return d;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!(await rateLimit(`admin-manual-create:${clientKey(req)}`, 5, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
    }

    const parsed = CreateManualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      firstName, lastName, birthDate, email, phone, isMinor,
      guardianName, guardianEmail, guardianPhone, guardianConsent,
      turnoIds, allergies, medications, swimmingAbility, tetanusStatus,
      fitnessSelf, dietaryNeeds, dietaryNotes, tshirtSize,
      arrivalMode, arrivalTime, departureTime,
      privacyConsent, marketingConsent, imageDataConsent,
      feePaid, balancePaid, notes, status
    } = parsed.data;

    const birth = asDateOr400(birthDate, "invalid-date");
    if (birth instanceof NextResponse) return birth;

    const { startDate: campStart } = await getCampStart();
    const ref = campStart || CAMP_START_FALLBACK;
    const computedAge = calcAge(birth, ref);

    const uniqueTurnoIds = [...new Set(turnoIds)];

    const created: { id: string; turnoNumber: number }[] = [];

    for (const turnoId of uniqueTurnoIds) {
      if (!canAccessTurn(session, turnoId)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      try {
        const iscr = await prisma.$transaction(async (tx) => {
          const turno = await tx.turno.findUnique({ where: { id: turnoId } });
          if (!turno) throw new Error("turno-not-found");

          // C-07: same atomic conditional update as the public route — no
          // TOCTOU race.
          const upd = await tx.turno.updateMany({
            where: { id: turnoId, bookedCount: { lt: turno.capacity } },
            data: { bookedCount: { increment: 1 } }
          });
          if (upd.count === 0) throw new Error("turn-full");

          return tx.iscrizione.create({
            data: {
              firstName,
              lastName,
              birthDate: birth,
              age: computedAge,
              email,
              phone,
              isMinor: !!isMinor,
              guardianName: guardianName ?? null,
              guardianEmail: guardianEmail ?? null,
              guardianPhone: guardianPhone ?? null,
              guardianConsent: !!guardianConsent,
              turnoId,
              allergies: allergies ?? null,
              medications: medications ?? null,
              swimmingAbility: swimmingAbility ?? null,
              tetanusStatus: tetanusStatus ?? null,
              fitnessSelf: fitnessSelf ?? null,
              dietaryNeeds: dietaryNeeds ?? null,
              dietaryNotes: dietaryNotes ?? null,
              tshirtSize: tshirtSize ?? null,
              arrivalMode: arrivalMode ?? null,
              arrivalTime: arrivalTime ?? null,
              departureTime: departureTime ?? null,
              privacyConsent: privacyConsent !== false,
              marketingConsent: !!marketingConsent,
              imageDataConsent: !!imageDataConsent,
              feePaid: !!feePaid,
              balancePaid: !!balancePaid,
              notes: notes ?? "[manuale]",
              status: status ?? "pending",
              managedBy: session.id
            }
          });
        });
        const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
        created.push({ id: iscr.id, turnoNumber: turno?.number ?? 0 });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "turn-full") {
          return NextResponse.json({ ok: false, error: "turn-full" }, { status: 409 });
        }
        if (msg === "turno-not-found") continue;
        throw err;
      }
    }

    return NextResponse.json({ ok: true, count: created.length, created });
  } catch (err) {
    console.error("manual POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!(await rateLimit(`admin-manual-update:${clientKey(req)}`, 5, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
    }

    const parsed = UpdateManualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { id, ...fields } = parsed.data;

    const existing = await prisma.iscrizione.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    if (!canAccessTurn(session, existing.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    const allowed = [
      "firstName", "lastName", "email", "phone", "isMinor",
      "guardianName", "guardianEmail", "guardianPhone", "guardianConsent",
      "allergies", "medications", "swimmingAbility", "tetanusStatus",
      "fitnessSelf", "dietaryNeeds", "dietaryNotes", "tshirtSize",
      "arrivalMode", "arrivalTime", "departureTime",
      "privacyConsent", "marketingConsent", "imageDataConsent",
      "notes", "status"
    ] as const;
    for (const key of allowed) {
      const v = fields[key];
      if (v !== undefined) {
        if (key === "notes" && typeof v === "string") {
          data[key] = sanitizeHtml(v).slice(0, LIMITS.MAX_NOTES);
        } else {
          data[key] = v;
        }
      }
    }
    if (fields.feePaid !== undefined) {
      data.feePaid = !!fields.feePaid;
      data.feePaidDate = fields.feePaid ? new Date() : null;
    }
    if (fields.balancePaid !== undefined) {
      data.balancePaid = !!fields.balancePaid;
      data.balancePaidDate = fields.balancePaid ? new Date() : null;
    }
    if (fields.birthDate !== undefined) {
      if (fields.birthDate) {
        const birth = asDateOr400(fields.birthDate, "invalid-date");
        if (birth instanceof NextResponse) return birth;
        data.birthDate = birth;
        const { startDate: campStart } = await getCampStart();
        const ref = campStart || CAMP_START_FALLBACK;
        data.age = calcAge(birth, ref);
      } else {
        data.birthDate = null;
        data.age = null;
      }
    }
    if (typeof data.email === "string") data.email = data.email.toLowerCase();
    data.managedBy = session.id;

    await prisma.iscrizione.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("manual PUT error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
