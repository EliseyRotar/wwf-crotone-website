import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

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

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid-date" }, { status: 400 });
  }

  const created: { id: string; turnoNumber: number }[] = [];

  for (const turnoId of turnoIds) {
    if (!canAccessTurn(session, turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden", turn: turnoId }, { status: 403 });
    }
    const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
    if (!turno) continue;

    const iscr = await prisma.iscrizione.create({
      data: {
        firstName,
        lastName,
        birthDate: birth,
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
    created.push({ id: iscr.id, turnoNumber: turno.number });
  }

  return NextResponse.json({ ok: true, count: created.length, created });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

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
      data[key] = fields[key];
    }
  }
  // Handle payment dates — set timestamp when flag is toggled on, clear when off
  if (fields.feePaid !== undefined) {
    data.feePaid = !!fields.feePaid;
    data.feePaidDate = fields.feePaid ? new Date() : null;
  }
  if (fields.balancePaid !== undefined) {
    data.balancePaid = !!fields.balancePaid;
    data.balancePaidDate = fields.balancePaid ? new Date() : null;
  }
  if (fields.birthDate) {
    const birth = new Date(fields.birthDate);
    if (!isNaN(birth.getTime())) data.birthDate = birth;
  }
  if (data.email) data.email = String(data.email).toLowerCase();
  data.managedBy = session.id;

  await prisma.iscrizione.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}