import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import TurnoEditor from "@/components/admin/TurnoEditor";

export const dynamic = "force-dynamic";

export default async function TurniPage() {
  await requireSuperadmin();
  const turni = await prisma.turno.findMany({
    orderBy: { number: "asc" },
    select: { id: true, number: true, startDate: true, endDate: true, capacity: true, isActive: true, bookedCount: true }
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight">Turni</h1>
        <p className="mt-1 text-sm text-[var(--ad-text-muted)]">
          Modifica la capacità di posti e lo stato di ogni turno.
        </p>
      </header>

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--ad-bg-sunken)] border-b border-[var(--ad-border)] text-left">
              <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                Turno
              </th>
              <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                Date
              </th>
              <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                Iscritti
              </th>
              <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                Capacità / Stato
              </th>
            </tr>
          </thead>
          <tbody>
            {turni.map((t) => (
              <tr key={t.id} className="border-b border-[var(--ad-border)] last:border-0">
                <td className="p-3 font-semibold text-[var(--ad-text)]">Campo {t.number}</td>
                <td className="p-3 text-[var(--ad-text-muted)]">
                  {t.startDate.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  {" → "}
                  {t.endDate.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </td>
                <td className="p-3 font-mono tabular-nums">{t.bookedCount}</td>
                <td className="p-3">
                  <TurnoEditor id={t.id} capacity={t.capacity} isActive={t.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}