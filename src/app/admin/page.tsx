import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "@/components/admin/DashboardCharts";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requireSession();

  const assignedIds = (session.assignedTurns ?? "").split(",").filter(Boolean);
  const scope = session.role === "superadmin" ? {} : { turnoId: { in: assignedIds } };
  const turnScope = session.role === "superadmin"
    ? { isActive: true }
    : { isActive: true, id: { in: assignedIds } };

  const [totalIscrizioni, pendingIscrizioni, turniCount, galleryCount, blogCount] = await Promise.all([
    prisma.iscrizione.count({ where: scope }),
    prisma.iscrizione.count({ where: { ...scope, status: "pending" } }),
    prisma.turno.count({ where: turnScope }),
    prisma.galleryItem.count(),
    prisma.blogPost.count({ where: { published: true } })
  ]);

  const turni = await prisma.turno.findMany({
    where: turnScope,
    orderBy: { number: "asc" },
    include: { _count: { select: { iscrizioni: true } } }
  });

  // Registrations by day
  const allIscr = await prisma.iscrizione.findMany({
    where: scope,
    select: { createdAt: true, birthDate: true, turnoId: true },
    orderBy: { createdAt: "asc" }
  });

  const cards = [
    { label: "Iscrizioni totali", value: totalIscrizioni, href: "/admin/iscrizioni" },
    { label: "In attesa", value: pendingIscrizioni, href: "/admin/iscrizioni?status=pending" },
    { label: "Turni attivi", value: turniCount, href: "/admin/turni" },
    { label: "Blog posts", value: blogCount, href: "/admin/blog" }
  ];

  return (
    <div>
      <h1 className="text-3xl mb-1">Dashboard</h1>
      <p className="text-ink-grey text-sm mb-8">Benvenuto, {session.name ?? session.email}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c, i) => (
          <a key={i} href={c.href} className="card">
            <div className="card-body">
              <p className="font-head text-4xl text-wwf-green">{c.value}</p>
              <p className="text-sm uppercase tracking-cta text-ink-grey">{c.label}</p>
            </div>
          </a>
        ))}
      </div>

      <DashboardCharts
        turni={turni.map((t) => ({ number: t.number, booked: t._count.iscrizioni, capacity: t.capacity }))}
        iscrizioni={allIscr.map((i) => ({
          date: i.createdAt.toISOString().slice(0, 10),
          age: new Date().getFullYear() - i.birthDate.getFullYear()
        }))}
      />
    </div>
  );
}