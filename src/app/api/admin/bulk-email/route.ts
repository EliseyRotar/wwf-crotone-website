import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendBulkEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { subject, body, turnoId, locale } = await req.json();
  if (!subject || !body) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

  const where = session.role !== "superadmin" && session.assignedTurns
    ? { turnoId: { in: [...(session.assignedTurns.split(",").filter(Boolean)), ...(turnoId ? [turnoId] : [])].filter((v, i, a) => a.indexOf(v) === i) }, status: { notIn: ["cancelled"] } }
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