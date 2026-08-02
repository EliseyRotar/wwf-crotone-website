import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * F21: Audit log viewer.
 * Restricted to superadmins (everyone else shouldn't see other users' actions).
 */
export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "superadmin") {
    return (
      <div>
        <h1 className="text-3xl mb-4">Audit</h1>
        <p className="text-ink-grey">Solo i superadmin possono accedere al log di audit.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const store = await cookies();
  const locale = store.get("admin-lang")?.value === "en" ? "en" : "it";
  const t = await getTranslations({ locale, namespace: "Admin.audit" });
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = sp.entity ? { entity: sp.entity } : {};
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [logs, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip
    }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: { id: true } })
  ]);

  return (
    <div>
      <h1 className="text-3xl mb-2">{t("title")}</h1>
      <p className="text-ink-grey mb-6">{t("subtitle")}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/audit" className={`tag ${!sp.entity ? "tag-green" : "tag-grey"}`}>{t("all")}</Link>
        {entities.map((e) => (
          <Link
            key={e.entity}
            href={`/admin/audit?entity=${e.entity}`}
            className={`tag ${sp.entity === e.entity ? "tag-green" : "tag-grey"}`}
          >
            {e.entity} ({e._count.id})
          </Link>
        ))}
      </div>

      {logs.length === 0 ? (
        <p className="text-ink-grey">{t("noResults")}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-grey-light text-left">
                <th className="p-3 uppercase tracking-cta text-ink-grey text-xs">{t("when")}</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey text-xs">{t("who")}</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey text-xs">{t("action")}</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey text-xs">{t("entity")}</th>
                <th className="p-3 uppercase tracking-cta text-ink-grey text-xs">{t("details")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-ink-grey-light/40">
                  <td className="p-3 text-xs whitespace-nowrap">
                    {log.createdAt.toLocaleString(locale === "it" ? "it-IT" : "en-GB")}
                  </td>
                  <td className="p-3 text-xs">{log.userId.slice(0, 8)}…</td>
                  <td className="p-3"><span className="tag tag-grey text-xs">{log.action}</span></td>
                  <td className="p-3 text-xs">{log.entity}</td>
                  <td className="p-3 text-xs text-ink-2 max-w-md truncate" title={log.details ?? ""}>
                    {log.details ? <code className="text-[10px]">{truncate(log.details, 120)}</code> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <p className="text-sm text-ink-grey mt-4">
          {t("page")} {safePage} {t("of")} {totalPages}
          {safePage < totalPages && (
            <Link href={`/admin/audit?page=${safePage + 1}${sp.entity ? `&entity=${sp.entity}` : ""}`} className="ml-3 underline">{t("next")} →</Link>
          )}
          {safePage > 1 && (
            <Link href={`/admin/audit?page=${safePage - 1}${sp.entity ? `&entity=${sp.entity}` : ""}`} className="ml-3 underline">← {t("previous")}</Link>
          )}
        </p>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
