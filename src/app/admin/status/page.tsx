/**
 * /admin/status — internal status page console.
 *
 * Three tabs:
 *   1. Services — list, edit, soft-delete, reactivate
 *   2. Incidents — open + recent, create new, post update, resolve
 *   3. History — 7d/30d uptime per service (read-only)
 *
 * Server component fetches the initial data. All mutations go through
 * child client components which call the admin API routes.
 */

import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getServiceUptime } from "@/lib/status";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import StatusAdminClient from "@/components/admin/StatusAdminClient";

export const dynamic = "force-dynamic";

export default async function StatusAdminPage() {
  await requireSuperadmin();
  const locale = (await cookies()).get("admin-lang")?.value === "en" ? "en" : "it";
  const t = await getTranslations({ locale, namespace: "Admin.status" });

  const services = await prisma.statusService.findMany({
    orderBy: [{ category: "asc" }, { display_order: "asc" }],
  });

  const [activeIncidents, recentIncidents] = await Promise.all([
    prisma.incident.findMany({
      where: { resolved_at: null },
      orderBy: { started_at: "desc" },
      include: { updates: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.incident.findMany({
      where: { resolved_at: { not: null } },
      orderBy: { resolved_at: "desc" },
      take: 30,
      include: { updates: { orderBy: { createdAt: "desc" } } },
    }),
  ]);

  // Per-service uptime for active rows
  const uptimes = new Map<string, { pct_7d: number | null; pct_30d: number | null }>();
  await Promise.all(
    services.map(async (s) => {
      const [u7, u30] = await Promise.all([
        getServiceUptime(s.slug, 7),
        getServiceUptime(s.slug, 30),
      ]);
      uptimes.set(s.id, { pct_7d: u7?.uptime_pct ?? null, pct_30d: u30?.uptime_pct ?? null });
    })
  );

  const slugById = new Map(services.map((s) => [s.id, s.slug]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-[var(--ad-text-muted)]">{t("page.subtitle")}</p>
      </header>
      <StatusAdminClient
        locale={locale}
        services={services.map((s) => ({
          id: s.id,
          slug: s.slug,
          name_it: s.name_it,
          name_en: s.name_en,
          category: s.category,
          source: s.source,
          source_id: s.source_id,
          url: s.url,
          active: s.active,
          display_order: s.display_order,
          uptime_7d: uptimes.get(s.id)?.pct_7d ?? null,
          uptime_30d: uptimes.get(s.id)?.pct_30d ?? null,
        }))}
        activeIncidents={activeIncidents.map((i) => ({
          id: i.id,
          service_slug: slugById.get(i.service_id ?? "") ?? "unknown",
          severity: i.severity,
          status: i.status,
          title_it: i.title_it,
          title_en: i.title_en,
          body_it: i.body_it,
          body_en: i.body_en,
          started_at: i.started_at.toISOString(),
          resolved_at: i.resolved_at?.toISOString() ?? null,
          updates: i.updates.map((u) => ({
            id: u.id,
            status: u.status,
            body_it: u.body_it,
            body_en: u.body_en,
            created_at: u.createdAt.toISOString(),
          })),
        }))}
        recentIncidents={recentIncidents.map((i) => ({
          id: i.id,
          service_slug: slugById.get(i.service_id ?? "") ?? "unknown",
          severity: i.severity,
          status: i.status,
          title_it: i.title_it,
          title_en: i.title_en,
          body_it: i.body_it,
          body_en: i.body_en,
          started_at: i.started_at.toISOString(),
          resolved_at: i.resolved_at?.toISOString() ?? null,
          updates: i.updates.map((u) => ({
            id: u.id,
            status: u.status,
            body_it: u.body_it,
            body_en: u.body_en,
            created_at: u.createdAt.toISOString(),
          })),
        }))}
      />
    </div>
  );
}
