import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccountSession } from "@/lib/accountSession";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { logFieldChange } from "@/lib/audit";
import {
  EDITABLE_FIELDS,
  FIELD_LABELS,
  lockReasonFor
} from "@/lib/bookingLock";
import { sendNotification } from "@/lib/mail";
import { SITE } from "@/config/site";
import { calcAge, getCampStart } from "@/lib/turns";

export const dynamic = "force-dynamic";

/**
 * Per-field validators. We use zod so the same rules that protect the
 * public booking endpoint also apply here. Optional values pass
 * `null` through unchanged (the user is unsetting the field).
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
  fields: perFieldSchema,
  locale: z.enum(["it", "en"]).default("it")
});

/**
 * POST /api/account/booking/[id]/update
 *
 * Body: { fields: { <fieldName>: newValue, ... }, locale }
 *
 * Authoritative editing endpoint for the personal area. The route:
 *   - Verifies the session, CSRF and rate limit
 *   - Verifies the booking belongs to the current volunteer
 *   - Verifies the lock rules (personalDataLockedAt + turno started)
 *   - Validates the payload with zod
 *   - Writes the update + one AuditLog row per changed field
 *   - Emails the admin and creates a Notification row per change batch
 *
 * The response is JSON so the client can update its UI without a full
 * reload. We return the list of fields we actually saved.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`acct-edit:${clientKey(req)}`, 30, 3600_000))) {
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

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      include: { turno: { select: { id: true, startDate: true, number: true } } }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    // Ownership: same email as the session OR same id. Refuse otherwise.
    const sessionEmail = session.email.toLowerCase();
    if (
      iscrizione.id !== session.iscrizioneId &&
      iscrizione.email.toLowerCase() !== sessionEmail
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // Filter to the subset the volunteer is actually allowed to send.
    // Anything not in EDITABLE_FIELDS is dropped silently.
    const incoming: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      const v = (parsed.data.fields as Record<string, unknown>)[f];
      if (v !== undefined) incoming[f] = v;
    }
    const incomingKeys = Object.keys(incoming);
    if (incomingKeys.length === 0) {
      return NextResponse.json({ ok: true, saved: [], rejected: [] });
    }

    // Apply lock rules. A field is rejected if its lockReason is non-null.
    const rejected: string[] = [];
    const allowed: Record<string, unknown> = {};
    for (const f of incomingKeys) {
      const reason = lockReasonFor(f, iscrizione);
      if (reason) {
        rejected.push(f);
      } else {
        allowed[f] = incoming[f];
      }
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "locked",
          rejected
        },
        { status: 403 }
      );
    }

    // Normalise values: empty strings become null, dates become Date.
    const data: Record<string, unknown> = {};
    const changes: { field: string; before: unknown; after: unknown }[] = [];
    for (const f of Object.keys(allowed)) {
      const raw = allowed[f];
      const before = (iscrizione as Record<string, unknown>)[f];
      let normalised: unknown = raw;
      if (raw === "") normalised = null;
      if (f === "birthDate" && typeof raw === "string" && raw) {
        const d = new Date(raw);
        if (isNaN(d.getTime())) {
          return NextResponse.json(
            { ok: false, error: "invalid-date", field: f },
            { status: 400 }
          );
        }
        normalised = d;
        // Recompute age to stay consistent with the rest of the app.
        try {
          const { startDate: ref } = await getCampStart();
          data.age = calcAge(d, ref);
        } catch {
          // best effort
        }
      }
      if (f === "email" && typeof raw === "string" && raw) {
        normalised = raw.toLowerCase();
      }
      data[f] = normalised;
      // Only record a change if the value actually differs.
      if (!isEqualish(before, normalised)) {
        changes.push({ field: f, before, after: normalised });
      }
    }

    if (changes.length === 0) {
      // Nothing actually changed. We still return ok so the client can
      // clear its dirty state.
      return NextResponse.json({ ok: true, saved: [], rejected });
    }

    // Write the update
    const updated = await prisma.iscrizione.update({
      where: { id: iscrizione.id },
      data
    });

    // One audit row per changed field. Best-effort.
    const ip = clientKey(req);
    const ua = req.headers.get("user-agent") ?? "";
    const savedFields: string[] = [];
    for (const c of changes) {
      savedFields.push(c.field);
      // fire-and-forget; logFieldChange never throws
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

    // Coarse action row so the change shows up in the audit list even
    // when the timeline filters by action only.
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

    // Notify admin (best-effort) and create a Notification row for the
    // admin panel.
    await notifyAdminAndCreateNotification({
      iscrizioneId: iscrizione.id,
      volunteerName: `${session.firstName} ${session.lastName}`,
      iscrizioneEmail: iscrizione.email,
      turnoNumber: iscrizione.turno?.number ?? 0,
      changes,
      ip,
      ua
    });

    return NextResponse.json({ ok: true, saved: savedFields, rejected });
  } catch (err) {
    console.error("booking update error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

/* ---------- helpers ---------- */

/**
 * Loose equality that handles Date → ISO string, null vs undefined and
 * "" vs null normalisation. We compare stringified forms so a Date
 * returned by Prisma matches the ISO string from the client.
 */
function isEqualish(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) {
    // Treat null and "" as equivalent (we normalise "" -> null).
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

async function notifyAdminAndCreateNotification(opts: {
  iscrizioneId: string;
  volunteerName: string;
  iscrizioneEmail: string;
  turnoNumber: number;
  changes: { field: string; before: unknown; after: unknown }[];
  ip: string;
  ua: string;
}) {
  // Build a human summary
  const lines = opts.changes
    .map((c) => {
      const meta = FIELD_LABELS[c.field];
      const label = meta?.label ?? c.field;
      const before = formatVal(c.before);
      const after = formatVal(c.after);
      return `• ${label}: ${before} → ${after}`;
    })
    .join("\n");
  const subject = `[Volontario] Modifica iscrizione — ${opts.volunteerName} (Campo ${opts.turnoNumber})`;
  const text = `Il volontario ${opts.volunteerName} (${opts.iscrizioneEmail}) ha modificato la propria iscrizione al Campo ${opts.turnoNumber}.

Campi modificati:
${lines}

ID Iscrizione: ${opts.iscrizioneId}
IP: ${opts.ip}
UA: ${opts.ua}

Vedi l'iscrizione: /admin/iscrizioni/${opts.iscrizioneId}`;

  // Best-effort email
  void sendNotification({
    to: process.env.ADMIN_NOTIFY_EMAIL ?? SITE.email,
    subject,
    text
  }).catch((err) => console.error("[booking-update] admin mail failed:", err));

  // Create a Notification row for the admin panel. We associate with
  // the first superadmin if we can find one; otherwise drop the
  // notification silently.
  try {
    const superadmin = await prisma.user.findFirst({
      where: { role: "superadmin", active: true, deletedAt: null },
      select: { id: true }
    });
    if (superadmin) {
      await prisma.notification.create({
        data: {
          userId: superadmin.id,
          type: "booking_edit",
          title: `Modifica iscrizione — ${opts.volunteerName}`,
          body: `${opts.changes.length} campo/i modificato/i (Campo ${opts.turnoNumber}).`,
          link: `/admin/iscrizioni/${opts.iscrizioneId}`
        }
      });
    }
  } catch (err) {
    console.error("[booking-update] notification row failed:", err);
  }
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  return String(v);
}
