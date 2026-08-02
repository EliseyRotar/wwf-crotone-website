import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionUser } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(escaped)) {
    return `"'${escaped}"`;
  }
  return `"${escaped}"`;
}

function parseDateInput(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getManagerTurns(session: SessionUser): string[] {
  return session.role === "superadmin"
    ? []
    : (session.assignedTurns ?? "").split(",").filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    // H-15: rate-limit bulk exports. An attacker (or buggy admin script)
    // could otherwise download every volunteer's PII on every request.
    if (!(await rateLimit(`csv:${clientKey(req)}`, 5, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    // F33: query-parameter filters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const turnoId = searchParams.get("campo");
    const from = parseDateInput(searchParams.get("from"));
    const toRaw = parseDateInput(searchParams.get("to"));
    const idsParam = searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",").filter(Boolean).slice(0, 500) : null;

    const managerTurns = getManagerTurns(session);

    // Scope to assigned turns for non-superadmins
    const baseWhere = session.role !== "superadmin"
      ? { turnoId: { in: managerTurns } }
      : {};

    const where: Record<string, unknown> = { ...baseWhere };
    if (status && ["pending", "confirmed", "paid", "cancelled", "waitlist"].includes(status)) {
      where.status = status;
    }
    if (turnoId) {
      // Manager can only request their own turns
      if (session.role !== "superadmin" && !managerTurns.includes(turnoId)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      where.turnoId = turnoId;
    }
    if (ids) {
      where.id = { in: ids };
    }
    if (from || toRaw) {
      const range: { gte?: Date; lte?: Date } = {};
      if (from) range.gte = from;
      if (toRaw) {
        const to = new Date(toRaw);
        to.setHours(23, 59, 59, 999);
        range.lte = to;
      }
      where.createdAt = range;
    }

    const iscrizioni = await prisma.iscrizione.findMany({
      where,
      select: {
        firstName: true, lastName: true, email: true, phone: true,
        birthDate: true, age: true, isMinor: true,
        guardianName: true, guardianEmail: true, guardianPhone: true,
        allergies: true, medications: true, swimmingAbility: true,
        tetanusStatus: true, fitnessSelf: true,
        dietaryNeeds: true, dietaryNotes: true, tshirtSize: true,
        arrivalMode: true, arrivalTime: true, departureTime: true,
        status: true, feePaid: true, feePaidDate: true,
        balancePaid: true, balancePaidDate: true,
        privacyConsent: true, marketingConsent: true, imageDataConsent: true,
        notes: true, createdAt: true,
        turno: { select: { number: true, startDate: true, endDate: true } },
        iscrizioneTurni: {
          select: { turno: { select: { number: true } }, isPrimary: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const header = [
      "Nome", "Cognome", "Email", "Telefono", "Data nascita/Eta", "Minorenne",
      "Genitore", "Email genitore", "Telefono genitore",
      "Turno", "Inizio", "Fine", "Turni extra",
      "Allergie", "Farmaci", "Nuoto", "Tetano", "Forma fisica",
      "Dieta", "Note dieta", "T-shirt", "Arrivo", "Orario arrivo", "Orario partenza",
      "Stato", "Quota 100 euro", "Data quota", "Saldo", "Data saldo",
      "Privacy", "Marketing", "Immagini", "Note admin", "Iscritto il"
    ];

    const rows = iscrizioni.map((i) => {
      const extraTurns = i.iscrizioneTurni
        .filter((it) => !it.isPrimary)
        .map((it) => it.turno.number)
        .join(",");
      return [
        i.firstName ?? "", i.lastName ?? "", i.email ?? "", i.phone ?? "",
        i.birthDate ? i.birthDate.toISOString().slice(0, 10) : (i.age ? `Eta: ${i.age}` : ""),
        i.isMinor ? "Si" : "No",
        i.guardianName ?? "", i.guardianEmail ?? "", i.guardianPhone ?? "",
        `Campo ${i.turno.number}`, i.turno.startDate.toISOString().slice(0, 10), i.turno.endDate.toISOString().slice(0, 10),
        extraTurns,
        i.allergies ?? "", i.medications ?? "", i.swimmingAbility ?? "", i.tetanusStatus ?? "", i.fitnessSelf ?? "",
        i.dietaryNeeds ?? "", i.dietaryNotes ?? "", i.tshirtSize ?? "", i.arrivalMode ?? "",
        i.arrivalTime ?? "", i.departureTime ?? "",
        i.status,
        i.feePaid ? "Si" : "No", i.feePaidDate ? i.feePaidDate.toISOString().slice(0, 10) : "",
        i.balancePaid ? "Si" : "No", i.balancePaidDate ? i.balancePaidDate.toISOString().slice(0, 10) : "",
        i.privacyConsent ? "Si" : "No", i.marketingConsent ? "Si" : "No", i.imageDataConsent ? "Si" : "No",
        i.notes ?? "", i.createdAt.toISOString()
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map((c) => escapeCsvCell(String(c))).join(","))
      .join("\r\n");

    // H-15: log the export. CSV exports contain every volunteer's PII;
    // we want a paper trail of who pulled what and when. Storing the
    // filters in `details` lets us correlate with a request signature if
    // a leak is later investigated.
    await logAudit({
      userId: session.id,
      action: "export",
      entity: "iscrizioni_csv",
      details: JSON.stringify({ filters: { status, turnoId, from, to: toRaw, ids } })
    });

    // Include filter info in the filename for traceability
    const dateTag = new Date().toISOString().slice(0, 10);
    const tagParts: string[] = [];
    if (status) tagParts.push(status);
    if (turnoId) tagParts.push("turno");
    if (from) tagParts.push(`from-${from.toISOString().slice(0, 10)}`);
    if (toRaw) tagParts.push(`to-${toRaw.toISOString().slice(0, 10)}`);
    const tag = tagParts.length > 0 ? `-${tagParts.join("-")}` : "";
    const filename = `iscrizioni-wwf-crotone${tag}-${dateTag}.csv`;

    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("CSV export error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
