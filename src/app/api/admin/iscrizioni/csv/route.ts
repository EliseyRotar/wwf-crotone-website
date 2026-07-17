import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const where = session.role === "superadmin" ? {} : {
    turnoId: { in: (session.assignedTurns ?? "").split(",").filter(Boolean) }
  };

  const iscrizioni = await prisma.iscrizione.findMany({
    where,
    include: { turno: true },
    orderBy: { createdAt: "desc" }
  });

  // CSV
  const header = [
    "Nome", "Cognome", "Email", "Telefono", "Data nascita", "Minorenne",
    "Genitore", "Email genitore", "Telefono genitore",
    "Turno", "Inizio", "Fine", "Turni extra",
    "Allergie", "Farmaci", "Nuoto", "Tetano", "Forma fisica",
    "Dieta", "Note dieta", "T-shirt", "Arrivo", "Orario arrivo", "Orario partenza",
    "Stato", "Quota 100€", "Data quota", "Saldo", "Data saldo",
    "Privacy", "Marketing", "Immagini", "Note admin", "Iscritto il"
  ];

  const rows = iscrizioni.map((i) => [
    i.firstName, i.lastName, i.email, i.phone, i.birthDate.toISOString().slice(0, 10),
    i.isMinor ? "Sì" : "No",
    i.guardianName ?? "", i.guardianEmail ?? "", i.guardianPhone ?? "",
    `Campo ${i.turno.number}`, i.turno.startDate.toISOString().slice(0, 10), i.turno.endDate.toISOString().slice(0, 10),
    i.additionalTurns ?? "",
    i.allergies ?? "", i.medications ?? "", i.swimmingAbility ?? "", i.tetanusStatus ?? "", i.fitnessSelf ?? "",
    i.dietaryNeeds ?? "", i.dietaryNotes ?? "", i.tshirtSize ?? "", i.arrivalMode ?? "",
    i.arrivalTime ?? "", i.departureTime ?? "",
    i.status,
    i.feePaid ? "Sì" : "No", i.feePaidDate ? i.feePaidDate.toISOString().slice(0, 10) : "",
    i.balancePaid ? "Sì" : "No", i.balancePaidDate ? i.balancePaidDate.toISOString().slice(0, 10) : "",
    i.privacyConsent ? "Sì" : "No", i.marketingConsent ? "Sì" : "No", i.imageDataConsent ? "Sì" : "No",
    i.notes ?? "", i.createdAt.toISOString()
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="iscrizioni-wwf-crotone-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}