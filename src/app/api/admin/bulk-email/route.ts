import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionUser } from "@/lib/auth";
import { sendBulkEmail } from "@/lib/mail";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

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

  const { subject, body, turnoId, locale, scheduleAt } = await req.json();
  if (!subject || !body) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  if (typeof subject !== "string" || subject.length > LIMITS.MAX_BULK_EMAIL_SUBJECT) {
    return NextResponse.json({ ok: false, error: "subject-too-long" }, { status: 400 });
  }
  if (typeof body !== "string" || body.length > LIMITS.MAX_BULK_EMAIL_BODY) {
    return NextResponse.json({ ok: false, error: "body-too-long" }, { status: 400 });
  }

  // F20: validate scheduleAt — must be a future ISO date if provided
  if (scheduleAt) {
    const ms = Date.parse(scheduleAt);
    if (isNaN(ms)) {
      return NextResponse.json({ ok: false, error: "invalid-schedule" }, { status: 400 });
    }
    if (ms <= Date.now()) {
      return NextResponse.json({ ok: false, error: "schedule-in-past" }, { status: 400 });
    }
  }

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

  const ok = await sendBulkEmail({ to: emails, subject, body, locale: locale || "it" });
  if (!ok) return NextResponse.json({ ok: false, error: "mail-failed" }, { status: 500 });
  return NextResponse.json({ ok: true, sent: emails.length });
}
