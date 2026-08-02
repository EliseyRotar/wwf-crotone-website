import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "@/components/admin/DashboardCharts";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requireSession();
  const store = await cookies();
  const locale = store.get("admin-lang")?.value === "en" ? "en" : "it";
  const t = await getTranslations({ locale, namespace: "Admin.dashboard" });

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
    // C-07: use the atomic counter for the chart, not the (includes
    // cancelled) relation count.
    select: { number: true, capacity: true, bookedCount: true }
  });

  const allIscr = await prisma.iscrizione.findMany({
    where: scope,
    select: { createdAt: true, birthDate: true, age: true, turnoId: true },
    orderBy: { createdAt: "asc" }
  });

  const cards = [
    { label: t("totalIscrizioni"), value: totalIscrizioni, href: "/admin/iscrizioni" },
    { label: t("inAttesa"), value: pendingIscrizioni, href: "/admin/iscrizioni?status=pending" },
    { label: t("campiAttivi"), value: turniCount, href: "/admin/turni" },
    { label: t("blogPosts"), value: blogCount, href: "/admin/blog" }
  ];

  return (
    <div>
      <h1 className="text-3xl mb-1">{t("welcome", { name: session.name ?? session.email })}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 mt-8">
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
        turni={turni.map((t_) => ({ number: t_.number, booked: t_.bookedCount, capacity: t_.capacity }))}
        iscrizioni={allIscr.map((i) => ({
          date: i.createdAt.toISOString().slice(0, 10),
          age: i.birthDate ? new Date().getFullYear() - i.birthDate.getFullYear() : (i.age ?? 0)
        }))}
      />
    </div>
  );
}