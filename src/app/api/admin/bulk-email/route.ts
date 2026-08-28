import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionUser } from "@/lib/auth";
import { sendBulkEmail } from "@/lib/mail";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const BulkEmailSchema = z
  .object({
    subject: z.string().trim().min(1).max(LIMITS.MAX_BULK_EMAIL_SUBJECT),
    body: z.string().min(1).max(LIMITS.MAX_BULK_EMAIL_BODY),
    turnoId: z.string().min(1).max(64).optional(),
    locale: z.enum(["it", "en"]).optional().default("it"),
    scheduleAt: z.string().min(8).max(40).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.scheduleAt) {
      const ms = Date.parse(data.scheduleAt);
      if (Number.isNaN(ms)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduleAt"],
          message: "invalid-schedule"
        });
        return;
      }
      if (ms <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduleAt"],
          message: "schedule-in-past"
        });
      }
    }
  });

function getManagerTurns(session: SessionUser): string[] {
  return session.role === "superadmin"
    ? []
    : (session.assignedTurns ?? "").split(",").filter(Boolean);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`bulk:${clientKey(req)}`, 3, 900_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = BulkEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { subject, body, turnoId, locale, scheduleAt } = parsed.data;

  const managerTurns = getManagerTurns(session);

  if (session.role !== "superadmin") {
    if (turnoId && !managerTurns.includes(turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  // F20: If scheduled, persist the job and return without sending immediately.
  // A cron / scheduled worker (out of scope for this codebase) would later
  // pick up rows with status="scheduled" and run the send.
  if (scheduleAt) {
    const job = await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "create",
        entity: "bulk_email",
        entityId: null,
        details: JSON.stringify({ subject, body, turnoId, locale, scheduleAt, status: "scheduled" })
      }
    });
    return NextResponse.json({ ok: true, scheduled: true, jobId: job.id, scheduleAt });
  }

  const where = session.role !== "superadmin"
    ? { turnoId: turnoId ?? managerTurns[0], status: { notIn: ["cancelled"] } }
    : turnoId
      ? { turnoId, status: { notIn: ["cancelled"] } }
      : { status: { notIn: ["cancelled"] } };

  const iscrizioni = await prisma.iscrizione.findMany({
    where,
    select: { email: true }
  });

  const emails = [...new Set(iscrizioni.map((i) => i.email))];
  if (emails.length === 0) return NextResponse.json({ ok: false, error: "no-recipients" }, { status: 400 });

  const ok = await sendBulkEmail({ to: emails, subject, body, locale });
  if (!ok) return NextResponse.json({ ok: false, error: "mail-failed" }, { status: 500 });
  return NextResponse.json({ ok: true, sent: emails.length });
}
