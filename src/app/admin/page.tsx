import Link from "next/link";
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

  const [
    totalIscrizioni,
    pendingIscrizioni,
    turniCount,
    galleryCount,
    blogCount,
    receiptsPending,
    balancePending
  ] = await Promise.all([
    prisma.iscrizione.count({ where: scope }),
    prisma.iscrizione.count({ where: { ...scope, status: "pending" } }),
    prisma.turno.count({ where: turnScope }),
    prisma.galleryItem.count(),
    prisma.blogPost.count({ where: { published: true } }),
    prisma.receiptUpload.count({
      where: { approvedAt: null, iscrizione: scope }
    }),
    prisma.iscrizione.count({
      where: { ...scope, feePaid: true, balancePaid: false, status: { not: "cancelled" } }
    })
  ]);

  const turni = await prisma.turno.findMany({
    where: turnScope,
    orderBy: { number: "asc" },
    select: { number: true, capacity: true, bookedCount: true }
  });

  const allIscr = await prisma.iscrizione.findMany({
    where: scope,
    select: { createdAt: true, birthDate: true, age: true, turnoId: true },
    orderBy: { createdAt: "asc" }
  });

  const cards = [
    {
      label: t("totalIscrizioni"),
      value: totalIscrizioni,
      href: "/admin/iscrizioni",
      tone: "default" as const
    },
    {
      label: t("inAttesa"),
      value: pendingIscrizioni,
      href: "/admin/iscrizioni?status=pending",
      tone: "warning" as const
    },
    {
      label: t("receiptsPending"),
      value: receiptsPending,
      href: "/admin/iscrizioni",
      tone: "warning" as const
    },
    {
      label: t("balancePending"),
      value: balancePending,
      href: "/admin/iscrizioni?status=confirmed",
      tone: "default" as const
    },
    {
      label: t("campiAttivi"),
      value: turniCount,
      href: "/admin/turni",
      tone: "default" as const
    },
    {
      label: t("blogPosts"),
      value: blogCount,
      href: "/admin/blog",
      tone: "default" as const
    }
  ];

  return (
    <div className="space-y-8">
      <header className="enter">
        <h1 className="font-head text-3xl lg:text-4xl text-[var(--ad-text)] tracking-tight">
          {t("welcome", { name: session.name ?? session.email })}
        </h1>
        <p className="mt-1 text-sm text-[var(--ad-text-muted)]">
          {new Date().toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
          })}
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <Link
            key={c.label}
            href={c.href}
            className={`enter enter-${Math.min(i + 1, 4)} group block p-5 rounded-[var(--radius-md)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] lift-hover`}
          >
            <p className="font-head text-3xl text-[var(--ad-text)] tabular-nums">
              {c.value}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-[var(--ad-text-subtle)]">
              {c.label}
            </p>
          </Link>
        ))}
      </section>

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