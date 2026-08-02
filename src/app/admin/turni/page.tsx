import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import TurnoEditor from "@/components/admin/TurnoEditor";

export const dynamic = "force-dynamic";

export default async function TurniPage() {
  await requireSuperadmin();
  const turni = await prisma.turno.findMany({
    orderBy: { number: "asc" },
    // C-07: surface the atomic counter (active registrations only).
    select: { id: true, number: true, startDate: true, endDate: true, capacity: true, isActive: true, bookedCount: true }
  });

  return (
    <div>
      <h1 className="text-3xl mb-1">Turni</h1>
      <p className="text-ink-grey text-sm mb-8">Modifica la capacità di posti e lo stato di ogni turno.</p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-grey-light text-left">
              <th className="p-3 uppercase tracking-cta text-ink-grey">Turno</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Date</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Iscritti</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Capacità / Stato</th>
            </tr>
          </thead>
          <tbody>
            {turni.map((t) => (
              <tr key={t.id} className="border-b border-ink-grey-light/60">
                <td className="p-3 font-bold">Campo {t.number}</td>
                <td className="p-3">{t.startDate.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })} → {t.endDate.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                <td className="p-3">{t.bookedCount}</td>
                <td className="p-3"><TurnoEditor id={t.id} capacity={t.capacity} isActive={t.isActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}