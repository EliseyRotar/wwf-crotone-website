import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { getCampStart, calcAge } from "@/lib/turns";
import { sanitizeHtml, LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const CAMP_START_FALLBACK = new Date("2026-06-21");

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      firstName, lastName, birthDate, email, phone, isMinor,
      guardianName, guardianEmail, guardianPhone, guardianConsent,
      turnoIds, allergies, medications, swimmingAbility, tetanusStatus,
      fitnessSelf, dietaryNeeds, dietaryNotes, tshirtSize,
      arrivalMode, arrivalTime, departureTime,
      privacyConsent, marketingConsent, imageDataConsent,
      feePaid, balancePaid, notes, status
    } = body;

    if (!firstName || !lastName || !birthDate || !email || !phone || !turnoIds || turnoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });
    }

    if (typeof firstName !== "string" || firstName.length > LIMITS.MAX_NAME) {
      return NextResponse.json({ ok: false, error: "invalid-name" }, { status: 400 });
    }
    if (typeof lastName !== "string" || lastName.length > LIMITS.MAX_NAME) {
      return NextResponse.json({ ok: false, error: "invalid-name" }, { status: 400 });
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
    }

    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid-date" }, { status: 400 });
    }

    const { startDate: campStart } = await getCampStart();
    const ref = campStart || CAMP_START_FALLBACK;
    const computedAge = calcAge(birth, ref);

    const uniqueTurnoIds = [...new Set(turnoIds as string[])];

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
              email: email.toLowerCase(),
              phone,
              isMinor: !!isMinor,
              guardianName: guardianName || null,
              guardianEmail: guardianEmail || null,
              guardianPhone: guardianPhone || null,
              guardianConsent: !!guardianConsent,
              turnoId,
              allergies: allergies || null,
              medications: medications || null,
              swimmingAbility: swimmingAbility || null,
              tetanusStatus: tetanusStatus || null,
              fitnessSelf: fitnessSelf || null,
              dietaryNeeds: dietaryNeeds || null,
              dietaryNotes: dietaryNotes || null,
              tshirtSize: tshirtSize || null,
              arrivalMode: arrivalMode || null,
              arrivalTime: arrivalTime || null,
              departureTime: departureTime || null,
              privacyConsent: privacyConsent !== false,
              marketingConsent: !!marketingConsent,
              imageDataConsent: !!imageDataConsent,
              feePaid: !!feePaid,
              balancePaid: !!balancePaid,
              notes: notes || "[manuale]",
              status: status || "pending",
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

    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

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
    ];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        if (key === "notes" && typeof fields[key] === "string") {
          data[key] = sanitizeHtml(fields[key] as string).slice(0, LIMITS.MAX_NOTES);
        } else {
          data[key] = fields[key];
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
        const birth = new Date(fields.birthDate);
        if (!isNaN(birth.getTime())) {
          data.birthDate = birth;
          const { startDate: campStart } = await getCampStart();
          const ref = campStart || CAMP_START_FALLBACK;
          data.age = calcAge(birth, ref);
        }
      } else {
        data.birthDate = null;
        data.age = null;
      }
    }
    if (data.email) data.email = String(data.email).toLowerCase();
    data.managedBy = session.id;

    await prisma.iscrizione.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("manual PUT error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
