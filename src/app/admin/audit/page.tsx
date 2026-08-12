import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Audit log viewer. Superadmin-only.
 */
export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "superadmin") {
    return (
      <div className="space-y-4">
        <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight">Audit</h1>
        <p className="text-sm text-[var(--ad-text-muted)]">
          Solo i superadmin possono accedere al log di audit.
        </p>
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
    <div className="space-y-6">
      <header>
        <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--ad-text-muted)]">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/audit"
          className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] border transition-colors ${
            !sp.entity
              ? "bg-[var(--ad-accent)] text-white border-[var(--ad-accent)]"
              : "bg-[var(--ad-bg-elevated)] text-[var(--ad-text-muted)] border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
          }`}
        >
          {t("all")}
        </Link>
        {entities.map((e) => (
          <Link
            key={e.entity}
            href={`/admin/audit?entity=${e.entity}`}
            className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] border transition-colors ${
              sp.entity === e.entity
                ? "bg-[var(--ad-accent)] text-white border-[var(--ad-accent)]"
                : "bg-[var(--ad-bg-elevated)] text-[var(--ad-text-muted)] border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
            }`}
          >
            {e.entity} ({e._count.id})
          </Link>
        ))}
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-[var(--ad-text-muted)]">{t("noResults")}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--ad-bg-sunken)] border-b border-[var(--ad-border)] text-left">
                <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">{t("when")}</th>
                <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">{t("who")}</th>
                <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">{t("action")}</th>
                <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">{t("entity")}</th>
                <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">{t("details")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--ad-border)] last:border-0">
                  <td className="p-3 text-xs whitespace-nowrap font-mono tabular-nums text-[var(--ad-text-muted)]">
                    {log.createdAt.toLocaleString(locale === "it" ? "it-IT" : "en-GB")}
                  </td>
                  <td className="p-3 text-xs font-mono text-[var(--ad-text-muted)]">{log.userId.slice(0, 8)}…</td>
                  <td className="p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--ad-bg-sunken)] text-[var(--ad-text-muted)]">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{log.entity}</td>
                  <td className="p-3 text-xs text-[var(--ad-text-muted)] max-w-md">
                    {log.details ? (
                      <code className="text-[10px] truncate block" title={log.details}>
                        {truncate(log.details, 120)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <p className="text-sm text-[var(--ad-text-muted)] flex items-center gap-3">
          <span>
            {t("page")} {safePage} {t("of")} {totalPages}
          </span>
          {safePage < totalPages && (
            <Link
              href={`/admin/audit?page=${safePage + 1}${sp.entity ? `&entity=${sp.entity}` : ""}`}
              className="underline hover:text-[var(--ad-accent)]"
            >
              {t("next")} →
            </Link>
          )}
          {safePage > 1 && (
            <Link
              href={`/admin/audit?page=${safePage - 1}${sp.entity ? `&entity=${sp.entity}` : ""}`}
              className="underline hover:text-[var(--ad-accent)]"
            >
              ← {t("previous")}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}