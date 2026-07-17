import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requireSession();

  // Managers scoped to assigned turns only; null/empty assignedTurns = no access
  const assignedIds = (session.assignedTurns ?? "").split(",").filter(Boolean);
  const scope = session.role === "superadmin"
    ? {}
    : { turnoId: { in: assignedIds } };
  const turnScope = session.role === "superadmin"
    ? { isActive: true }
    : { isActive: true, id: { in: assignedIds } };

  const [totalIscrizioni, pendingIscrizioni, turniCount, galleryCount] = await Promise.all([
    prisma.iscrizione.count({ where: scope }),
    prisma.iscrizione.count({ where: { ...scope, status: "pending" } }),
    prisma.turno.count({ where: turnScope }),
    prisma.galleryItem.count()
  ]);

  const turni = await prisma.turno.findMany({
    where: turnScope,
    orderBy: { number: "asc" },
    include: { _count: { select: { iscrizioni: true } } }
  });

  const cards = [
    { label: "Iscrizioni totali", value: totalIscrizioni, href: "/admin/iscrizioni" },
    { label: "In attesa", value: pendingIscrizioni, href: "/admin/iscrizioni?status=pending" },
    { label: "Turni attivi", value: turniCount, href: "/admin/turni" },
    { label: "Media galleria", value: galleryCount, href: "/admin/gallery" }
  ];

  return (
    <div>
      <h1 className="text-3xl mb-1">Dashboard</h1>
      <p className="text-ink-grey text-sm mb-8">Benvenuto, {session.name ?? session.email}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c, i) => (
          <Link key={i} href={c.href} className="card">
            <div className="card-body">
              <p className="font-head text-4xl text-wwf-green">{c.value}</p>
              <p className="text-sm uppercase tracking-cta text-ink-grey">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="text-xl mb-4">Turni — iscrizioni</h2>
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-grey-light text-left">
              <th className="p-3 uppercase tracking-cta text-ink-grey">Turno</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Date</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Iscritti</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Capacità</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Stato</th>
            </tr>
          </thead>
          <tbody>
            {turni.map((t) => {
              const booked = t._count.iscrizioni;
              const pct = Math.round((booked / t.capacity) * 100);
              return (
                <tr key={t.id} className="border-b border-ink-grey-light/60">
                  <td className="p-3 font-bold">{t.number}</td>
                  <td className="p-3">{t.startDate.toLocaleDateString("it-IT")} → {t.endDate.toLocaleDateString("it-IT")}</td>
                  <td className="p-3">{booked}</td>
                  <td className="p-3">{t.capacity}</td>
                  <td className="p-3">
                    <div className="w-24 h-2 bg-ink-grey-light">
                      <div className="h-full bg-wwf-green" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}