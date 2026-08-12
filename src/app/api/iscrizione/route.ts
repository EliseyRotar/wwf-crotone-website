import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyNewIscrizione, sendRegistrationConfirmation } from "@/lib/mail";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { getCampStart, isUnder18, calcAge } from "@/lib/turns";
import {
  signLookupToken,
  LOOKUP_COOKIE_NAME,
  LOOKUP_COOKIE_MAX_AGE_S
} from "@/lib/lookupToken";
import { createVerificationTokenForIscrizione } from "@/lib/userFlow";

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

const CAMP_START_FALLBACK = new Date("2026-06-21");

export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`isc:${clientKey(req)}`, 3, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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

    const { startDate: campStart } = await getCampStart();
    const ref = campStart || CAMP_START_FALLBACK;
    const age = calcAge(birth, ref);
    const serverMinor = isUnder18(birth, ref);
    if (serverMinor !== d.isMinor) {
      return NextResponse.json({ ok: false, error: "minor-mismatch" }, { status: 400 });
    }
    if (serverMinor && (!d.guardianName || !d.guardianPhone || !d.guardianConsent)) {
      return NextResponse.json({ ok: false, error: "guardian-required" }, { status: 400 });
    }

    // Validate all turns — must be active, not past, not full, no duplicates per turn
    const turni = await prisma.turno.findMany({
      where: { id: { in: d.turnoIds } },
      select: { id: true, number: true, isActive: true, startDate: true, endDate: true, capacity: true }
    });
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

    // Dedupe turnoIds to prevent duplicate rows
    const uniqueTurnoIds = [...new Set(d.turnoIds)];
    const primaryTurnoId = uniqueTurnoIds[0];

    // M5: one Iscrizione + N IscrizioneTurno junction rows (replaces the
    // additionalTurns CSV). All checks + writes happen inside a single
    // transaction so we can roll back atomically on any failure.
    //
    // C-07: capacity is enforced via an atomic conditional UPDATE on
    // Turno.bookedCount — only succeeds when bookedCount < capacity.
    // The previous read-then-write `count()` could allow two concurrent
    // requests to both observe 19/20 slots and both succeed, oversubscribing
    // the turn. With the conditional update, only one of them wins.
    let createdIscrizioneId = "";
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Capacity check across all requested turns (atomic, per turn)
        for (const turnoId of uniqueTurnoIds) {
          const turno = turni.find((t) => t.id === turnoId)!;
          // Conditional increment: only updates if bookedCount < capacity.
          // If capacity is reached or exceeded, updateMany.count === 0 and
          // we throw "turn-full".
          const updated = await tx.turno.updateMany({
            where: { id: turnoId, bookedCount: { lt: turno.capacity } },
            data: { bookedCount: { increment: 1 } }
          });
          if (updated.count === 0) {
            throw Object.assign(new Error("turn-full"), { turnoNumber: turno.number });
          }
          // Duplicate check by email within the same turn
          const dup = await tx.iscrizione.findFirst({
            where: {
              turnoId,
              email: d.email.toLowerCase(),
              status: { notIn: ["cancelled"] }
            }
          });
          if (dup) {
            // Roll back the increment we just did for this turn.
            await tx.turno.update({
              where: { id: turnoId },
              data: { bookedCount: { decrement: 1 } }
            });
            throw Object.assign(new Error("duplicate"), { turnoNumber: turno.number });
          }
        }

        // Create the single Iscrizione row (primary turn on the FK)
        const iscrizione = await tx.iscrizione.create({
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
            turnoId: primaryTurnoId,
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
            imageDataConsent: d.imageDataConsent ?? false,
            iscrizioneTurni: {
              create: uniqueTurnoIds.map((tid) => ({
                turnoId: tid,
                isPrimary: tid === primaryTurnoId
              }))
            }
          }
        });

        return iscrizione;
      });
      createdIscrizioneId = result.id;
    } catch (err) {
      const e = err as Error & { turnoNumber?: number };
      if (e.message === "turn-full") {
        return NextResponse.json(
          { ok: false, error: "turn-full", turn: e.turnoNumber },
          { status: 409 }
        );
      }
      if (e.message === "duplicate") {
        return NextResponse.json(
          { ok: false, error: "duplicate", turn: e.turnoNumber },
          { status: 409 }
        );
      }
      throw err;
    }

    // Notify admin with the FULL iscrizione data (subject is "Nuova
    // iscrizione ricevuta — …"). The HTML template is the redesigned
    // responsive WWF-branded email.
    const primaryTurno = turni.find((t) => t.id === primaryTurnoId)!;
    const fmtDate = (d: Date) =>
      d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    void notifyNewIscrizione({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      birthDate: d.birthDate,
      age: age,
      isMinor: serverMinor,
      guardianName: d.guardianName,
      guardianEmail: d.guardianEmail,
      guardianPhone: d.guardianPhone,
      guardianConsent: d.guardianConsent,
      allergies: d.allergies,
      medications: d.medications,
      swimmingAbility: d.swimmingAbility,
      tetanusStatus: d.tetanusStatus,
      fitnessSelf: d.fitnessSelf,
      dietaryNeeds: d.dietaryNeeds,
      dietaryNotes: d.dietaryNotes,
      tshirtSize: d.tshirtSize,
      arrivalMode: d.arrivalMode,
      arrivalTime: d.arrivalTime,
      departureTime: d.departureTime,
      privacyConsent: d.privacyConsent,
      marketingConsent: d.marketingConsent ?? false,
      imageDataConsent: d.imageDataConsent ?? false,
      turno: `Campo ${primaryTurno.number}`,
      turnoStart: fmtDate(primaryTurno.startDate),
      turnoEnd: fmtDate(primaryTurno.endDate),
      extraTurni: uniqueTurnoIds.length > 1
        ? turni.filter((t) => t.id !== primaryTurnoId).map((t) => `Campo ${t.number}`)
        : undefined,
      locale: d.locale,
      adminPanelUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "") + "/admin/iscrizioni"
    });

    // Phase 2: mint a 24h verification token for the new Iscrizione
    // and email the volunteer a magic link. The link goes to
    // /api/iscrizione/[id]/verify-email which advances the lifecycle
    // from "pending" to "email_verified".
    try {
      const { rawToken } = await createVerificationTokenForIscrizione(
        createdIscrizioneId,
        "email_verified",
        24 * 60 * 60 * 1000
      );
      const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
      const verifyUrl = `${siteBase}/${d.locale}/account/verify?token=${encodeURIComponent(rawToken)}`;
      void sendRegistrationConfirmation({
        to: d.email.toLowerCase(),
        firstName: d.firstName,
        lastName: d.lastName,
        verifyUrl,
        locale: d.locale
      }).catch((err) =>
        console.error("[iscrizione] registration-confirmation mail failed:", err)
      );
    } catch (err) {
      // Non-fatal: the Iscrizione exists. The admin can still trigger
      // a verify email from the panel if needed. We log so the team
      // notices the failure.
      console.error("[iscrizione] failed to mint verify token / send email:", err);
    }

    return NextResponse.json({ ok: true, id: createdIscrizioneId, count: uniqueTurnoIds.length }, {
      headers: {
        // C-03: issue an HMAC-signed lookup cookie so the volunteer can
        // come back later to /mio-iscrizione without a real account.
        // Bound to NODE_ENV for the Secure attribute (relaxed in dev).
        "Set-Cookie": `${LOOKUP_COOKIE_NAME}=${signLookupToken(createdIscrizioneId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LOOKUP_COOKIE_MAX_AGE_S}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
      }
    });
  } catch (err) {
    console.error("iscrizione POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}