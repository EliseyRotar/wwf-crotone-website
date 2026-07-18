import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import RosterClient from "@/components/admin/RosterClient";

export const dynamic = "force-dynamic";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ turno?: string }> }) {
  await requireSession();
  const sp = await searchParams;

  const turni = await prisma.turno.findMany({ orderBy: { number: "asc" } });
  const selectedTurnoId = sp.turno ?? turni[0]?.id ?? "";

  const iscrizioni = selectedTurnoId
    ? await prisma.iscrizione.findMany({
        where: { turnoId: selectedTurnoId, status: { notIn: ["cancelled"] } },
        orderBy: { firstName: "asc" }
      })
    : [];

  return (
    <RosterClient
      turni={turni.map((t) => ({ id: t.id, number: t.number, start: t.startDate.toISOString(), end: t.endDate.toISOString() }))}
      selectedTurnoId={selectedTurnoId}
      iscrizioni={iscrizioni.map((i) => ({
        id: i.id,
        firstName: i.firstName,
        lastName: i.lastName,
        isMinor: i.isMinor,
        phone: i.phone,
        email: i.email,
        dietaryNeeds: i.dietaryNeeds,
        allergies: i.allergies,
        arrivalMode: i.arrivalMode,
        arrivalTime: i.arrivalTime,
        feePaid: i.feePaid,
        balancePaid: i.balancePaid
      }))}
    />
  );
}