import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import {
  UserCheck,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  LogIn,
  Mail,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { AuditRowPretty } from "@/components/admin/AuditRowPretty";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Audit log viewer. Superadmin-only.
 *
 * Each row renders TWO views:
 *   - Pretty: human-friendly summary (Volunteer "X" uploaded a deposit
 *     receipt, status moved from "Email verified" to "Receipt in review",
 *     etc.). Collapsible by default.
 *   - Raw:    the original JSON details string from the audit row, for
 *     technical debugging. A "Mostra dati grezzi" toggle at the top of
 *     the page reveals raw rows for everyone; an inline toggle reveals
 *     one row at a time.
 */
export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ entity?: string; page?: string; raw?: string }>;
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
  const tAdmin = await getTranslations({ locale, namespace: "Admin" });
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const showRaw = sp.raw === "1";

  const where = sp.entity ? { entity: sp.entity } : {};
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [logs, entities, volunteerMap] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip
    }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: { id: true } }),
    // Pre-resolve volunteer names for any audit row whose entityId is
    // an Iscrizione.id. We need this so we can show "Mario Rossi" next
    // to "iscrizione_edit" instead of a raw CUID fragment.
    (async () => {
      const iscIds = await prisma.auditLog.findMany({
        where: { entity: "iscrizione" },
        select: { entityId: true },
        take: 500
      });
      const uniqueIds = Array.from(new Set(iscIds.map((i) => i.entityId).filter((id): id is string => !!id)));
      if (uniqueIds.length === 0) return new Map<string, { firstName: string; lastName: string }>();
      const rows = await prisma.iscrizione.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, firstName: true, lastName: true }
      });
      return new Map(rows.map((r) => [r.id, { firstName: r.firstName, lastName: r.lastName }]));
    })()
  ]);

  // Resolve the audit actor's name (superadmin user) when possible
  const actorIds = Array.from(new Set(logs.map((l) => l.userId).filter(Boolean)));
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true, name: true }
    });
    for (const u of users) actorMap.set(u.id, u.name || u.email);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--ad-text-muted)]">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
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
            href={`/admin/audit?entity=${e.entity}${showRaw ? "&raw=1" : ""}`}
            className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] border transition-colors ${
              sp.entity === e.entity
                ? "bg-[var(--ad-accent)] text-white border-[var(--ad-accent)]"
                : "bg-[var(--ad-bg-elevated)] text-[var(--ad-text-muted)] border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
            }`}
          >
            {e.entity} ({e._count.id})
          </Link>
        ))}

        {/* Right-aligned raw toggle */}
        <Link
          href={`/admin/audit?${sp.entity ? `entity=${sp.entity}&` : ""}raw=${showRaw ? "0" : "1"}`}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] text-[var(--ad-text-muted)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors"
          title={showRaw ? "Nascondi i dati grezzi" : "Mostra i dati grezzi (JSON)"}
        >
          {showRaw ? <EyeOff size={12} /> : <Eye size={12} />}
          {showRaw ? tAdmin("rawDataHide") : tAdmin("rawDataShow")}
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-[var(--ad-text-muted)]">{t("noResults")}</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const actor = actorMap.get(log.userId) ?? log.userId.slice(0, 8) + "…";
            const subject = log.entity === "iscrizione" && log.entityId ? volunteerMap.get(log.entityId) : null;
            return (
              <li
                key={log.id}
                className="rounded-[var(--radius-md)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] overflow-hidden"
              >
                <AuditRowPretty
                  log={log}
                  actor={actor}
                  subject={subject ?? null}
                  locale={locale}
                  showRawDefault={showRaw}
                />
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <p className="text-sm text-[var(--ad-text-muted)] flex items-center gap-3">
          <span>
            {t("page")} {safePage} {t("of")} {totalPages}
          </span>
          {safePage < totalPages && (
            <Link
              href={`/admin/audit?page=${safePage + 1}${sp.entity ? `&entity=${sp.entity}` : ""}${showRaw ? "&raw=1" : ""}`}
              className="underline hover:text-[var(--ad-accent)]"
            >
              {t("next")} →
            </Link>
          )}
          {safePage > 1 && (
            <Link
              href={`/admin/audit?page=${safePage - 1}${sp.entity ? `&entity=${sp.entity}` : ""}${showRaw ? "&raw=1" : ""}`}
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
