import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccountSession } from "@/lib/accountSession";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { logFieldChange } from "@/lib/audit";
import { isRegistrationEditable } from "@/lib/userFlow";
import {
  EDITABLE_FIELDS,
  FIELD_LABELS,
  PERSONAL_DATA_FIELDS
} from "@/lib/bookingLock";

export const dynamic = "force-dynamic";

/**
 * Per-field schema, mirroring src/app/api/account/booking/[id]/update.
 * We intentionally duplicate the schema here rather than import it
 * because the new flow is gated by isRegistrationEditable and the
 * Phase 2 lock — slightly different from the existing personal-area
 * flow.
 */
const perFieldSchema = z.object({
  firstName: z.string().min(1).max(80).optional().nullable(),
  lastName: z.string().min(1).max(80).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().min(4).max(40).optional().nullable(),
  isMinor: z.boolean().optional(),
  guardianName: z.string().max(80).optional().nullable(),
  guardianEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  guardianPhone: z.string().max(40).optional().nullable(),
  guardianConsent: z.boolean().optional(),
  allergies: z.string().max(2000).optional().nullable(),
  medications: z.string().max(2000).optional().nullable(),
  swimmingAbility: z.enum(["none", "basic", "confident"]).optional().nullable().or(z.literal("")),
  tetanusStatus: z.enum(["unknown", "vaccinated", "not_vaccinated"]).optional().nullable().or(z.literal("")),
  fitnessSelf: z.string().max(2000).optional().nullable(),
  dietaryNeeds: z.enum(["none", "vegetarian", "vegan", "celiac", "other"]).optional().nullable().or(z.literal("")),
  dietaryNotes: z.string().max(2000).optional().nullable(),
  tshirtSize: z.enum(["S", "M", "L", "XL", "XXL"]).optional().nullable().or(z.literal("")),
  arrivalMode: z.enum(["own_car", "train", "bus", "plane_crotone", "plane_lamezia", "need_pickup"]).optional().nullable().or(z.literal("")),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal("")),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal("")),
  privacyConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  imageDataConsent: z.boolean().optional()
});

const bodySchema = z.object({
  fields: perFieldSchema
});

/**
 * POST /api/iscrizione/[id]/edit
 *
 * Phase 2 edit endpoint. The difference from the existing
 * /api/account/booking/[id]/update route:
 *
 *   - Gated by isRegistrationEditable (status === "confirmed" /
 *     editsLockedAt set / turno within 7 days → 403 "locked")
 *   - Same per-field whitelist as the existing route
 *   - Same audit log shape
 *
 * We do NOT call out to the admin (notifications, mail) here — the
 * Phase 2 user flow is shorter and the admin sees the changes via
 * the AuditLog + the status-change mail already triggered on confirm.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`userflow-edit:${clientKey(req)}`, 30, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const session = await getAccountSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      include: { turno: { select: { startDate: true, number: true } } }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    if (
      iscrizione.id !== session.iscrizioneId &&
      iscrizione.email.toLowerCase() !== session.email.toLowerCase()
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // Phase 2 lock check. Tighter than the Phase 1 personal-area
    // check: confirmed / locked / within 7 days of turno → 403.
    if (!isRegistrationEditable(iscrizione)) {
      return NextResponse.json({ ok: false, error: "locked" }, { status: 403 });
    }

    // Filter incoming payload to the editable whitelist.
    const incoming: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      const v = (parsed.data.fields as Record<string, unknown>)[f];
      if (v !== undefined) incoming[f] = v;
    }
    const incomingKeys = Object.keys(incoming);
    if (incomingKeys.length === 0) {
      return NextResponse.json({ ok: true, saved: [], rejected: [] });
    }

    // Apply the Phase 1 per-field personal-data lock on top of the
    // Phase 2 global lock. (Both can co-exist: Phase 2 stops all
    // edits, Phase 1 stops only the identity fields if the admin has
    // frozen them.)
    const rejected: string[] = [];
    const allowed: Record<string, unknown> = {};
    for (const f of incomingKeys) {
      const isPersonal = (PERSONAL_DATA_FIELDS as readonly string[]).includes(f);
      if (isPersonal && iscrizione.personalDataLockedAt) {
        rejected.push(f);
      } else {
        allowed[f] = incoming[f];
      }
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json(
        { ok: false, error: "locked", rejected },
        { status: 403 }
      );
    }

    // Normalise + collect changes.
    const data: Record<string, unknown> = {};
    const changes: { field: string; before: unknown; after: unknown }[] = [];
    for (const f of Object.keys(allowed)) {
      const raw = allowed[f];
      const before = (iscrizione as Record<string, unknown>)[f];
      let normalised: unknown = raw;
      if (raw === "") normalised = null;
      if (f === "email" && typeof raw === "string" && raw) {
        normalised = raw.toLowerCase();
      }
      if (f === "birthDate" && typeof raw === "string" && raw) {
        const d = new Date(raw);
        if (isNaN(d.getTime())) {
          return NextResponse.json(
            { ok: false, error: "invalid-date", field: f },
            { status: 400 }
          );
        }
        normalised = d;
      }
      data[f] = normalised;
      if (!isEqualish(before, normalised)) {
        changes.push({ field: f, before, after: normalised });
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({ ok: true, saved: [], rejected });
    }

    const updated = await prisma.iscrizione.update({
      where: { id: iscrizione.id },
      data
    });

    const ip = clientKey(req);
    const ua = req.headers.get("user-agent") ?? "";
    const savedFields: string[] = [];
    for (const c of changes) {
      savedFields.push(c.field);
      void logFieldChange({
        userId: session.iscrizioneId,
        entity: "iscrizione",
        entityId: iscrizione.id,
        fieldName: c.field,
        oldValue: c.before,
        newValue: c.after,
        ipAddress: ip,
        userAgent: ua
      });
    }

    // Coarse action row for the timeline (matches the existing route).
    void logFieldChange({
      userId: session.iscrizioneId,
      entity: "iscrizione",
      entityId: iscrizione.id,
      fieldName: "(batch)",
      oldValue: null,
      newValue: `${changes.length} field(s): ${changes.map((c) => c.field).join(", ")}`,
      ipAddress: ip,
      userAgent: ua,
      action: "field_change_batch"
    });

    return NextResponse.json({
      ok: true,
      iscrizioneId: updated.id,
      saved: savedFields,
      rejected
    });
  } catch (err) {
    console.error("userflow edit POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

function isEqualish(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) {
    if ((a == null && b === "") || (b == null && a === "")) return true;
    return false;
  }
  if (a instanceof Date && typeof b === "string") {
    return a.toISOString() === b || a.toISOString().slice(0, 10) === b;
  }
  if (b instanceof Date && typeof a === "string") {
    return b.toISOString() === a || b.toISOString().slice(0, 10) === a;
  }
  return false;
}

// Suppress unused-import warning for FIELD_LABELS (kept for parity
// with the existing update route — useful when a future caller wants
// to format change summaries).
void FIELD_LABELS;
