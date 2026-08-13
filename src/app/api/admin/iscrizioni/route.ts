import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Whitelist of fields an admin can edit on an Iscrizione. Two scopes:
 *
 *   - `PAYMENT_STATUS_FIELDS`: status, notes, payment flags — both
 *     superadmin and the assigned turn manager can change these.
 *   - `VOLUNTEER_FIELDS`: all the volunteer's personal data — only
 *     superadmin can edit (managers are scoped to their assigned
 *     turns and shouldn't be touching other volunteers' data).
 *
 * Anything not on these lists is silently dropped. The schema is
 * effectively owned by the volunteer; the admin endpoint is a narrow
 * escape hatch.
 */
const PAYMENT_STATUS_FIELDS = [
  "status",
  "notes",
  "feePaid",
  "balancePaid"
] as const;
const VOLUNTEER_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "email",
  "phone",
  "isMinor",
  "guardianName",
  "guardianEmail",
  "guardianPhone",
  "guardianConsent",
  "allergies",
  "medications",
  "swimmingAbility",
  "tetanusStatus",
  "fitnessSelf",
  "dietaryNeeds",
  "dietaryNotes",
  "tshirtSize",
  "arrivalMode",
  "arrivalTime",
  "departureTime"
] as const;
const ALL_EDITABLE_FIELDS = [...PAYMENT_STATUS_FIELDS, ...VOLUNTEER_FIELDS];

const VALID_STATUSES = [
  "pending",
  "email_verified",
  "receipt_uploaded",
  "confirmed",
  "paid",
  "cancelled",
  "waitlist"
];

const VALID_ENUMS: Record<string, ReadonlySet<string>> = {
  swimmingAbility: new Set(["none", "basic", "confident"]),
  tetanusStatus: new Set(["unknown", "vaccinated", "not_vaccinated"]),
  dietaryNeeds: new Set(["none", "vegetarian", "vegan", "celiac", "other"]),
  arrivalMode: new Set([
    "own_car",
    "train",
    "bus",
    "plane_crotone",
    "plane_lamezia",
    "need_pickup"
  ]),
  tshirtSize: new Set(["S", "M", "L", "XL", "XXL"])
};

/**
 * Coerce a JSON value into the right shape for the Prisma column.
 * Returns `null` for invalid input rather than throwing, so a single
 * bad field doesn't blow up the whole patch.
 */
function coerce(field: string, raw: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  // Booleans: status, feePaid, balancePaid, isMinor, guardianConsent
  if (["feePaid", "balancePaid", "isMinor", "guardianConsent"].includes(field)) {
    if (typeof raw === "boolean") return { ok: true, value: raw };
    return { ok: false, reason: "expected boolean" };
  }
  // Enums
  if (field === "status") {
    if (typeof raw === "string" && VALID_STATUSES.includes(raw)) return { ok: true, value: raw };
    return { ok: false, reason: "invalid status" };
  }
  if (field in VALID_ENUMS) {
    const allowed = VALID_ENUMS[field];
    if (raw === null || raw === "") return { ok: true, value: null };
    if (typeof raw === "string" && allowed.has(raw)) return { ok: true, value: raw };
    return { ok: false, reason: `expected one of ${[...allowed].join(", ")}` };
  }
  // birthDate: ISO date or null
  if (field === "birthDate") {
    if (raw === null || raw === "") return { ok: true, value: null };
    if (typeof raw === "string") {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return { ok: true, value: d };
    }
    return { ok: false, reason: "expected ISO date or null" };
  }
  // Short text fields: truncate to a sane length
  if (
    [
      "firstName",
      "lastName",
      "email",
      "phone",
      "guardianName",
      "guardianEmail",
      "guardianPhone",
      "allergies",
      "medications",
      "fitnessSelf",
      "dietaryNotes",
      "arrivalTime",
      "departureTime",
      "notes"
    ].includes(field)
  ) {
    if (raw === null) return { ok: true, value: null };
    if (typeof raw === "string") {
      const max = field === "notes" ? 5000 : field === "allergies" || field === "medications" || field === "dietaryNotes" ? 1000 : 200;
      return { ok: true, value: raw.slice(0, max) };
    }
    return { ok: false, reason: "expected string or null" };
  }
  return { ok: false, reason: "unknown field" };
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!(await rateLimit(`admin-isc:${clientKey(req)}`, 30, 60000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findUnique({
      where: { id },
      include: { turno: { select: { capacity: true } } }
    });
    if (!iscrizione) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    if (!canAccessTurn(session, iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // Determine which fields the caller is allowed to touch:
    //   - Payment/status fields: any admin who can see this turn
    //   - Volunteer fields: superadmin only
    const attempted = Object.keys(body).filter((k) => k !== "id" && ALL_EDITABLE_FIELDS.includes(k as never));
    const hasVolunteerEdit = attempted.some((f) =>
      (VOLUNTEER_FIELDS as readonly string[]).includes(f)
    );
    if (hasVolunteerEdit && session.role !== "superadmin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    const rejected: Record<string, string> = {};
    for (const field of attempted) {
      const c = coerce(field, body[field]);
      if (c.ok) {
        data[field] = c.value;
      } else {
        rejected[field] = c.reason;
      }
    }

    // Stamps: payment transitions update the *PaidDate + receiptApprovedAt
    // columns so the admin panel's "Approvata il …" tooltip stays accurate.
    if ("feePaid" in data) {
      if (data.feePaid) {
        data.feePaidDate = new Date();
        data.depositReceiptApprovedAt = new Date();
      } else {
        data.feePaidDate = null;
        data.depositReceiptApprovedAt = null;
      }
    }
    if ("balancePaid" in data) {
      if (data.balancePaid) {
        data.balancePaidDate = new Date();
        data.balanceReceiptApprovedAt = new Date();
      } else {
        data.balancePaidDate = null;
        data.balanceReceiptApprovedAt = null;
      }
    }
    data.managedBy = session.id;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: "no-edits", rejected },
        { status: 400 }
      );
    }

    // C-07: capacity accounting on cancel / re-activate.
    const wasActive = iscrizione.status !== "cancelled";
    const goingToCancelled = data.status === "cancelled";

    await prisma.$transaction(async (tx) => {
      await tx.iscrizione.update({ where: { id }, data });

      if (goingToCancelled && wasActive) {
        await tx.turno.updateMany({
          where: { id: iscrizione.turnoId, bookedCount: { gt: 0 } },
          data: { bookedCount: { decrement: 1 } }
        });
      } else if (!goingToCancelled && !wasActive) {
        await tx.turno.updateMany({
          where: {
            id: iscrizione.turnoId,
            bookedCount: { lt: iscrizione.turno.capacity ?? Number.MAX_SAFE_INTEGER }
          },
          data: { bookedCount: { increment: 1 } }
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: "iscrizione_edit",
      entity: "iscrizione",
      entityId: id,
      details: JSON.stringify({ fields: Object.keys(data), rejected })
    });
    return NextResponse.json({ ok: true, rejected });
  } catch (err) {
    console.error("iscrizione PATCH error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    if (session.role !== "superadmin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!(await rateLimit(`admin-del:${clientKey(req)}`, 10, 60000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    const existing = await prisma.iscrizione.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

    // C-07: deletion is the same as a cancel — free up the slot, but only
    // if the row counted (i.e. it wasn't already cancelled).
    const wasActive = existing.status !== "cancelled";
    await prisma.$transaction(async (tx) => {
      await tx.iscrizione.delete({ where: { id } });
      if (wasActive) {
        await tx.turno.updateMany({
          where: { id: existing.turnoId, bookedCount: { gt: 0 } },
          data: { bookedCount: { decrement: 1 } }
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: "delete",
      entity: "iscrizione",
      entityId: id
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("iscrizione DELETE error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
