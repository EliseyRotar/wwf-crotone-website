import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyNewIscrizione } from "@/lib/mail";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  birthDate: z.string().min(1),
  email: z.string().email().max(200),
  phone: z.string().min(4).max(40),
  isMinor: z.boolean(),
  guardianName: z.string().max(80).optional(),
  guardianEmail: z.string().email().max(200).optional().or(z.literal("")),
  guardianPhone: z.string().max(40).optional(),
  guardianConsent: z.boolean().optional(),
  // Multi-turn: array of turn IDs
  turnoIds: z.array(z.string().min(1)).min(1),
  allergies: z.string().max(2000).optional(),
  medications: z.string().max(2000).optional(),
  swimmingAbility: z.enum(["none", "basic", "confident"]).optional().or(z.literal("")),
  tetanusStatus: z.enum(["unknown", "vaccinated", "not_vaccinated"]).optional().or(z.literal("")),
  fitnessSelf: z.string().max(2000).optional(),
  dietaryNeeds: z.enum(["none", "vegetarian", "vegan", "celiac", "other"]).optional().or(z.literal("")),
  dietaryNotes: z.string().max(2000).optional(),
  tshirtSize: z.enum(["S", "M", "L", "XL", "XXL"]).optional().or(z.literal("")),
  arrivalMode: z.enum(["own_car", "train", "bus", "plane_crotone", "plane_lamezia", "need_pickup"]).optional().or(z.literal("")),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
  privacyConsent: z.boolean().refine((v) => v === true, { message: "Consent required" }),
  marketingConsent: z.boolean().optional(),
  imageDataConsent: z.boolean().optional(),
  locale: z.enum(["it", "en"]).default("it")
});

const CAMP_START = new Date("2026-06-21");

// Calculate if someone is under 18 on a given date (exact date comparison, not ms approximation)
function isUnder18(birth: Date, ref: Date): boolean {
  let age = ref.getFullYear() - birth.getFullYear();
  const hadBirthday =
    ref.getMonth() > birth.getMonth() ||
    (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  return age < 18;
}

export async function POST(req: Request) {
  try {
    if (!rateLimit(`isc:${clientKey(req)}`, 3, 3600_000)) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const body = await req.json();
    const hp = (body as { website?: string }).website;
    if (hp) return NextResponse.json({ ok: true });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    const d = parsed.data;

    // Validate birthDate
    const birthMs = Date.parse(d.birthDate);
    if (isNaN(birthMs)) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    const birth = new Date(birthMs);
    const now = new Date();
    if (birth.getTime() > now.getTime()) {
      return NextResponse.json({ ok: false, error: "birth-future" }, { status: 400 });
    }

    const serverMinor = isUnder18(birth, CAMP_START);
    if (serverMinor !== d.isMinor) {
      return NextResponse.json({ ok: false, error: "minor-mismatch" }, { status: 400 });
    }
    if (serverMinor && (!d.guardianName || !d.guardianPhone || !d.guardianConsent)) {
      return NextResponse.json({ ok: false, error: "guardian-required" }, { status: 400 });
    }

    // Validate all turns — must be active, not past, not full, no duplicates per turn
    const turni = await prisma.turno.findMany({ where: { id: { in: d.turnoIds } } });
    if (turni.length !== d.turnoIds.length) {
      return NextResponse.json({ ok: false, error: "turn-invalid" }, { status: 400 });
    }

    for (const turno of turni) {
      if (!turno.isActive) {
        return NextResponse.json({ ok: false, error: "turn-invalid" }, { status: 400 });
      }
      if (turno.endDate.getTime() < now.getTime()) {
        return NextResponse.json({ ok: false, error: "turn-past" }, { status: 400 });
      }
    }

    // Move duplicate check inside transaction to prevent TOCTOU race
    // Create one iscrizione per turn, rollback all on any failure
    const created: { id: string; turnoNumber: number }[] = [];
    const primaryTurnoId = d.turnoIds[0];
    const additionalTurnIds = d.turnoIds.slice(1).join(",") || null;

    for (const turnoId of d.turnoIds) {
      const turno = turni.find((t) => t.id === turnoId)!;
      try {
        const iscrizione = await prisma.$transaction(async (tx) => {
          // Capacity check inside transaction
          const booked = await tx.iscrizione.count({
            where: { turnoId, status: { notIn: ["cancelled"] } }
          });
          if (booked >= turno.capacity) {
            throw new Error("turn-full");
          }
          // Duplicate check inside transaction
          const dup = await tx.iscrizione.findFirst({
            where: {
              turnoId,
              firstName: d.firstName,
              lastName: d.lastName,
              status: { notIn: ["cancelled"] }
            }
          });
          if (dup) {
            throw new Error("duplicate");
          }
          return tx.iscrizione.create({
            data: {
              firstName: d.firstName,
              lastName: d.lastName,
              birthDate: birth,
              email: d.email.toLowerCase(),
              phone: d.phone,
              isMinor: serverMinor,
              guardianName: d.guardianName ?? null,
              guardianEmail: d.guardianEmail || null,
              guardianPhone: d.guardianPhone ?? null,
              guardianConsent: d.guardianConsent ?? false,
              turnoId,
              additionalTurns: turnoId === primaryTurnoId ? additionalTurnIds : null,
              allergies: d.allergies || null,
              medications: d.medications || null,
              swimmingAbility: d.swimmingAbility || null,
              tetanusStatus: d.tetanusStatus || null,
              fitnessSelf: d.fitnessSelf || null,
              dietaryNeeds: d.dietaryNeeds || null,
              dietaryNotes: d.dietaryNotes || null,
              tshirtSize: d.tshirtSize || null,
              arrivalMode: d.arrivalMode || null,
              arrivalTime: d.arrivalTime || null,
              departureTime: d.departureTime || null,
              privacyConsent: d.privacyConsent,
              marketingConsent: d.marketingConsent ?? false,
              imageDataConsent: d.imageDataConsent ?? false
            }
          });
        });
        created.push({ id: iscrizione.id, turnoNumber: turno.number });
      } catch (err) {
        // Rollback: delete any already-created iscrizioni for this person
        if (created.length > 0) {
          await prisma.iscrizione.deleteMany({
            where: { id: { in: created.map((c) => c.id) } }
          });
        }
        if ((err as Error).message === "turn-full") {
          return NextResponse.json({ ok: false, error: "turn-full", turn: turno.number }, { status: 409 });
        }
        if ((err as Error).message === "duplicate") {
          return NextResponse.json({ ok: false, error: "duplicate", turn: turno.number }, { status: 409 });
        }
        throw err;
      }
    }

    // Notify admin
    const primaryTurno = turni[0];
    void notifyNewIscrizione({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      turno: `${created.map((c) => `Campo ${c.turnoNumber}`).join(" + ")} (${turni.length} ${d.locale === "it" ? "settimane" : "weeks"})`,
      isMinor: serverMinor,
      locale: d.locale
    });

    return NextResponse.json({ ok: true, id: created[0].id, count: created.length });
  } catch (err) {
    console.error("iscrizione POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}