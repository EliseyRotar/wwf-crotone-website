import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import IscrizioneRowControls from "@/components/admin/IscrizioneRowControls";
import ManualAddVolunteer from "@/components/admin/ManualAddVolunteer";
import EditVolunteer from "@/components/admin/EditVolunteer";
import ViewVolunteer from "@/components/admin/ViewVolunteer";
import DeleteVolunteer from "@/components/admin/DeleteVolunteer";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

// Calculate age correctly: subtract 1 if birthday hasn't happened yet this year.
// Reference date is the camp start (June 21, 2026) — that's when the age matters.
const CAMP_START = new Date("2026-06-21");
function calcAge(birthDate: Date, refDate: Date = CAMP_START): number {
  let age = refDate.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    refDate.getMonth() > birthDate.getMonth() ||
    (refDate.getMonth() === birthDate.getMonth() && refDate.getDate() >= birthDate.getDate());
  if (!hadBirthday) age--;
  return age;
}

export default async function IscrizioniPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; turno?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const where: { status?: string; turnoId?: string } = {};
  if (sp.status && ["pending", "confirmed", "paid", "cancelled", "waitlist"].includes(sp.status)) {
    where.status = sp.status;
  }
  if (sp.turno) where.turnoId = sp.turno;

  // Managers scoped to assigned turns only; null/empty assignedTurns = no access
  const managerTurnFilter =
    session.role !== "superadmin"
      ? { turnoId: { in: (session.assignedTurns ?? "").split(",").filter(Boolean) } }
      : {};

  const iscrizioni = await prisma.iscrizione.findMany({
    where: { ...where, ...managerTurnFilter },
    include: { turno: true },
    orderBy: { createdAt: "desc" }
  });

  const turni = await prisma.turno.findMany({ orderBy: { number: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl">Iscrizioni</h1>
        <div className="flex gap-2 flex-wrap">
          <ManualAddVolunteer turni={turni.map((t) => ({ id: t.id, number: t.number, start: t.startDate, end: t.endDate }))} />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/iscrizioni/csv" className="btn btn-outline">
            <Download size={18} /> Esporta CSV
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/admin/iscrizioni" className={`tag ${!sp.status ? "tag-green" : "tag-grey"}`}>Tutte</Link>
        {["pending", "confirmed", "paid", "waitlist", "cancelled"].map((s) => (
          <Link
            key={s}
            href={`/admin/iscrizioni?status=${s}`}
            className={`tag ${sp.status === s ? "tag-green" : "tag-grey"}`}
          >
            {s === "pending" ? "In attesa" : s === "confirmed" ? "Confermato" : s === "paid" ? "Pagato" : s === "waitlist" ? "Lista d&apos;attesa" : "Annullato"}
          </Link>
        ))}
      </div>

      {iscrizioni.length === 0 ? (
        <p className="text-ink-grey">Nessuna iscrizione trovata.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-grey-light text-left">
                <th className="p-3 uppercase tracking-cta text-ink-grey">Nome</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey">Email</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey">Telefono</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey">Turno</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey">Età</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey">Pagamenti</th>
                <th className="p-3 text-xs uppercase tracking-cta text-ink-grey">Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {iscrizioni.map((i) => {
                const age = calcAge(i.birthDate);
                return (
                  <tr key={i.id} className="border-b border-ink-grey-light/60 hover:bg-sand">
                    <td className="p-3 font-bold">
                      {i.firstName} {i.lastName}
                      {i.isMinor && <span className="tag tag-orange ml-2">minore</span>}
                    </td>
                    <td className="p-3"><a href={`mailto:${i.email}`} className="text-wwf-green hover:underline">{i.email}</a></td>
                    <td className="p-3"><a href={`tel:${i.phone}`} className="hover:underline">{i.phone}</a></td>
                    <td className="p-3">Campo {i.turno.number}</td>
                    <td className="p-3">{age}</td>
                    <td className="p-3">
                      <IscrizioneRowControls
                        id={i.id}
                        status={i.status}
                        feePaid={i.feePaid}
                        balancePaid={i.balancePaid}
                        notes={i.notes}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <ViewVolunteer
                          iscrizione={{
                            id: i.id,
                            firstName: i.firstName,
                            lastName: i.lastName,
                            birthDate: i.birthDate.toISOString(),
                            email: i.email,
                            phone: i.phone,
                            isMinor: i.isMinor,
                            guardianName: i.guardianName,
                            guardianEmail: i.guardianEmail,
                            guardianPhone: i.guardianPhone,
                            guardianConsent: i.guardianConsent,
                            allergies: i.allergies,
                            medications: i.medications,
                            swimmingAbility: i.swimmingAbility,
                            tetanusStatus: i.tetanusStatus,
                            fitnessSelf: i.fitnessSelf,
                            dietaryNeeds: i.dietaryNeeds,
                            dietaryNotes: i.dietaryNotes,
                            tshirtSize: i.tshirtSize,
                            arrivalMode: i.arrivalMode,
                            arrivalTime: i.arrivalTime,
                            departureTime: i.departureTime,
                            status: i.status,
                            feePaid: i.feePaid,
                            feePaidDate: i.feePaidDate?.toISOString() ?? null,
                            balancePaid: i.balancePaid,
                            balancePaidDate: i.balancePaidDate?.toISOString() ?? null,
                            notes: i.notes,
                            imageDataConsent: i.imageDataConsent,
                            marketingConsent: i.marketingConsent,
                            privacyConsent: i.privacyConsent,
                            turnoNumber: i.turno.number,
                            turnoStart: i.turno.startDate.toISOString(),
                            turnoEnd: i.turno.endDate.toISOString(),
                            additionalTurns: i.additionalTurns,
                            createdAt: i.createdAt.toISOString()
                          }}
                        />
                        <EditVolunteer
                          iscrizione={{
                            id: i.id,
                            firstName: i.firstName,
                            lastName: i.lastName,
                            birthDate: i.birthDate.toISOString(),
                            email: i.email,
                            phone: i.phone,
                            isMinor: i.isMinor,
                            guardianName: i.guardianName,
                            guardianEmail: i.guardianEmail,
                            guardianPhone: i.guardianPhone,
                            allergies: i.allergies,
                            medications: i.medications,
                            swimmingAbility: i.swimmingAbility,
                            tetanusStatus: i.tetanusStatus,
                            fitnessSelf: i.fitnessSelf,
                            dietaryNeeds: i.dietaryNeeds,
                            dietaryNotes: i.dietaryNotes,
                            tshirtSize: i.tshirtSize,
                            arrivalMode: i.arrivalMode,
                            arrivalTime: i.arrivalTime,
                            departureTime: i.departureTime,
                            status: i.status,
                            feePaid: i.feePaid,
                            balancePaid: i.balancePaid,
                            notes: i.notes,
                            imageDataConsent: i.imageDataConsent
                          }}
                        />
                        <DeleteVolunteer id={i.id} name={`${i.firstName} ${i.lastName}`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}