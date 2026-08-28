/**
 * GET    /api/booking-draft          — fetch the user's current draft (by cookie)
 * PUT    /api/booking-draft          — upsert the user's draft
 * DELETE /api/booking-draft          — clear the user's draft
 *
 * The draft is identified by a random opaque ID stored in an HttpOnly
 * cookie. No auth required — these endpoints are intentionally public
 * (a stranger with the cookie can read the draft, but it has no useful
 * data without the matching DB row, and the rate limit + cookie
 * randomness make brute-force impossible).
 *
 * The previous localStorage persistence (commit history has the
 * BookingForm changes) put PII (name, email, phone, birthDate,
 * allergies, medications) in plain text in the browser. This server-
 * side version closes that GDPR hole.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "wwf_booking_draft";
const COOKIE_TTL_S = 60 * 60 * 24 * 30; // 30 days
const MAX_DRAFT_AGE_DAYS = 30;

const FormFieldsSchema = z
  .object({
    firstName: z.string().trim().max(LIMITS.MAX_NAME).optional().default(""),
    lastName: z.string().trim().max(LIMITS.MAX_NAME).optional().default(""),
    birthDate: z.string().max(20).optional().default(""),
    email: z.string().trim().toLowerCase().email().max(LIMITS.MAX_EMAIL).optional().or(z.literal("")).default(""),
    phone: z.string().trim().max(LIMITS.MAX_PHONE).optional().default(""),
    isMinor: z.boolean().optional().default(false),
    guardianName: z.string().trim().max(LIMITS.MAX_NAME).optional().default(""),
    guardianEmail: z.string().trim().max(LIMITS.MAX_EMAIL).optional().default(""),
    guardianPhone: z.string().trim().max(LIMITS.MAX_PHONE).optional().default(""),
    guardianConsent: z.boolean().optional().default(false),
    turnoIds: z.array(z.string().min(1).max(64)).max(20).optional().default([]),
    allergies: z.string().max(LIMITS.MAX_STRING).optional().default(""),
    medications: z.string().max(LIMITS.MAX_STRING).optional().default(""),
    swimmingAbility: z.string().max(40).optional().default(""),
    tetanusStatus: z.string().max(40).optional().default(""),
    fitnessSelf: z.string().max(40).optional().default(""),
    dietaryNeeds: z.string().max(40).optional().default("none"),
    dietaryNotes: z.string().max(LIMITS.MAX_STRING).optional().default(""),
    tshirtSize: z.string().max(20).optional().default(""),
    arrivalMode: z.string().max(40).optional().default(""),
    arrivalFrom: z.string().max(LIMITS.MAX_STRING).optional().default(""),
    flightNumber: z.string().max(40).optional().default(""),
    trainNumber: z.string().max(40).optional().default(""),
    busCompany: z.string().max(80).optional().default(""),
    arrivalNotes: z.string().max(LIMITS.MAX_STRING).optional().default(""),
    arrivalTime: z.string().max(20).optional().default(""),
    departureTime: z.string().max(20).optional().default(""),
    privacyConsent: z.boolean().optional().default(false),
    marketingConsent: z.boolean().optional().default(false),
    imageDataConsent: z.boolean().optional().default(false),
    website: z.string().max(500).optional().default("") // honeypot
  })
  .strict();

const PutDraftSchema = z
  .object({
    step: z.number().int().min(0).max(10).optional().default(0),
    data: FormFieldsSchema
  })
  .strict();

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function genDraftId(): string {
  // 32 bytes base64url = 256 bits of entropy. Random enough.
  return crypto.randomBytes(32).toString("base64url");
}

async function readDraftId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

async function writeDraftId(draftId: string): Promise<void> {
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  store.set(COOKIE_NAME, draftId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_S
  });
}

async function clearDraftId(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function GET(req: Request) {
  if (!(await rateLimit(`booking-draft-get:${clientKey(req)}`, 60, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const draftId = await readDraftId();
  if (!draftId) {
    return NextResponse.json({ ok: true, draft: null });
  }

  const row = await prisma.bookingDraft.findUnique({ where: { draftId } });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    // Expired — clean up silently and return null.
    if (row) {
      await prisma.bookingDraft.delete({ where: { draftId } }).catch(() => undefined);
    }
    await clearDraftId();
    return NextResponse.json({ ok: true, draft: null });
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.data);
  } catch {
    // Corrupt JSON — treat as no draft.
    await prisma.bookingDraft.delete({ where: { draftId } }).catch(() => undefined);
    await clearDraftId();
    return NextResponse.json({ ok: true, draft: null });
  }

  return NextResponse.json({
    ok: true,
    draft: {
      step: row.step,
      data: parsed,
      updatedAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString()
    }
  });
}

export async function PUT(req: Request) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`booking-draft-put:${clientKey(req)}`, 30, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = PutDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { step, data } = parsed.data;
  const ua = req.headers.get("user-agent")?.slice(0, 256) ?? null;

  const existingId = await readDraftId();
  const ipKey = clientKey(req);
  const ipHash = ipKey !== "unknown" ? hashIp(ipKey) : null;
  const expiresAt = new Date(Date.now() + MAX_DRAFT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const serialized = JSON.stringify(data);

  let draftId = existingId;
  if (draftId) {
    // Try update
    try {
      const row = await prisma.bookingDraft.update({
        where: { draftId },
        data: {
          data: serialized,
          step,
          expiresAt,
          ipHash: ipHash ?? undefined,
          userAgent: ua ?? undefined
        }
      });
      return NextResponse.json({
        ok: true,
        draftId: row.draftId,
        expiresAt: row.expiresAt.toISOString()
      });
    } catch {
      // Row doesn't exist (cookie outlived the row) — fall through to create.
      draftId = null;
    }
  }
  if (!draftId) draftId = genDraftId();

  await prisma.bookingDraft.create({
    data: {
      draftId,
      data: serialized,
      step,
      ipHash: ipHash ?? undefined,
      userAgent: ua ?? undefined,
      expiresAt
    }
  });
  await writeDraftId(draftId);

  return NextResponse.json({
    ok: true,
    draftId,
    expiresAt: expiresAt.toISOString()
  });
}

export async function DELETE(req: Request) {
  if (!(await rateLimit(`booking-draft-del:${clientKey(req)}`, 30, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }
  const draftId = await readDraftId();
  if (draftId) {
    await prisma.bookingDraft.delete({ where: { draftId } }).catch(() => undefined);
  }
  await clearDraftId();
  return NextResponse.json({ ok: true });
}
