import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import IscrizioneDetailPanel from "@/components/admin/IscrizioneDetailPanel";
import ManualAddVolunteer from "@/components/admin/ManualAddVolunteer";
import BulkEmailButton from "@/components/admin/BulkEmailButton";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getCampStart, calcAge } from "@/lib/turns";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function IscrizioniPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; turno?: string; from?: string; to?: string; page?: string; q?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const store = await cookies();
  const { startDate: campStart } = await getCampStart();
  const locale = store.get("admin-lang")?.value === "en" ? "en" : "it";
  const t = await getTranslations({ locale, namespace: "Admin.iscrizioni" });

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (sp.status && ["pending", "confirmed", "paid", "cancelled", "waitlist"].includes(sp.status)) {
    where.status = sp.status;
  }
  if (sp.turno) where.turnoId = sp.turno;

  if (sp.from || sp.to) {
    where.createdAt = {};
    if (sp.from) {
      const d = new Date(sp.from);
      if (!isNaN(d.getTime())) (where.createdAt as Record<string, Date>).gte = d;
    }
    if (sp.to) {
      const d = new Date(sp.to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = d;
      }
    }
  }

  // F22: free-text search across name/email/phone (case-insensitive
  // — Postgres `contains` is case-sensitive by default, which makes
  // the search feel broken for users typing a lowercase query).
  if (sp.q && sp.q.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } }
    ];
  }

  const managerTurnFilter = session.role !== "superadmin"
    ? { turnoId: { in: (session.assignedTurns ?? "").split(",").filter(Boolean) } }
    : {};

  const combinedWhere = { ...where, ...managerTurnFilter };

  const total = await prisma.iscrizione.count({ where: combinedWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [iscrizioni, turni] = await Promise.all([
    prisma.iscrizione.findMany({
      where: combinedWhere,
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        birthDate: true, age: true, isMinor: true, status: true, feePaid: true,
        balancePaid: true, feePaidDate: true, balancePaidDate: true,
        guardianName: true, guardianEmail: true, guardianPhone: true,
        guardianConsent: true, allergies: true, medications: true,
        swimmingAbility: true, tetanusStatus: true, fitnessSelf: true,
        dietaryNeeds: true, dietaryNotes: true, tshirtSize: true,
        arrivalMode: true, arrivalTime: true, departureTime: true,
        notes: true, imageDataConsent: true, marketingConsent: true, privacyConsent: true,
        createdAt: true,
        turno: { select: { number: true, startDate: true, endDate: true } },
        iscrizioneTurni: {
          select: { isPrimary: true, turno: { select: { number: true } } }
        },
        receiptUploads: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, type: true, originalName: true, mimeType: true,
            byteSize: true, approvedAt: true, approvedBy: true,
            rejectionReason: true, createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE
    }),
    prisma.turno.findMany({
      orderBy: { number: "asc" },
      select: { id: true, number: true, startDate: true, endDate: true }
    })
  ]);

  const statusLabels: Record<string, string> = {
    pending: t("pending"),
    confirmed: t("confirmed"),
    paid: t("paid"),
    waitlist: t("waitlist"),
    cancelled: t("cancelled")
  };

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.turno) params.set("turno", sp.turno);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.q) params.set("q", sp.q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/iscrizioni?${qs}` : "/admin/iscrizioni";
  };

  const buildCsvHref = () => {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.turno) params.set("turno", sp.turno);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    const qs = params.toString();
    return qs ? `/api/admin/iscrizioni/csv?${qs}` : "/api/admin/iscrizioni/csv";
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--ad-text-muted)]">
            {total} {t("results")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ManualAddVolunteer
            turni={turni.map((tt) => ({ id: tt.id, number: tt.number, start: tt.startDate, end: tt.endDate }))}
          />
          <a
            href={buildCsvHref()}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors"
          >
            <Download size={14} /> {t("exportCsv")}
          </a>
        </div>
      </header>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 bg-[var(--ad-bg)] border-b border-[var(--ad-border)]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={buildHref(1).replace(/[?&]page=\d+/g, "")}
              className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] border transition-colors ${
                !sp.status
                  ? "bg-[var(--ad-accent)] text-white border-[var(--ad-accent)]"
                  : "bg-[var(--ad-bg-elevated)] text-[var(--ad-text-muted)] border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
              }`}
            >
              {t("all")}
            </Link>
            {["pending", "confirmed", "paid", "waitlist", "cancelled"].map((s) => {
              const active = sp.status === s;
              return (
                <Link
                  key={s}
                  href={`/admin/iscrizioni?status=${s}`}
                  className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] border transition-colors ${
                    active
                      ? "bg-[var(--ad-accent)] text-white border-[var(--ad-accent)]"
                      : "bg-[var(--ad-bg-elevated)] text-[var(--ad-text-muted)] border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
                  }`}
                >
                  {statusLabels[s]}
                </Link>
              );
            })}
          </div>

          <div className="h-5 w-px bg-[var(--ad-border)] mx-2" aria-hidden="true" />

          {/* Turno filter — server-side form-based to avoid needing a client component */}
          <form className="flex items-center gap-1.5" method="get">
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            {sp.from && <input type="hidden" name="from" value={sp.from} />}
            {sp.to && <input type="hidden" name="to" value={sp.to} />}
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            <select
              name="turno"
              defaultValue={sp.turno ?? ""}
              className="text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] text-[var(--ad-text)]"
            >
              <option value="">{t("filterTurn")} — tutti</option>
              {turni.map((tt) => (
                <option key={tt.id} value={tt.id}>C{tt.number}</option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--ad-bg-sunken)] text-[var(--ad-text-muted)] hover:bg-[var(--ad-accent-soft)] hover:text-[var(--ad-accent)] transition-colors"
              aria-label="Applica filtro turno"
            >
              OK
            </button>
          </form>

          {/* Date range */}
          <form className="flex flex-wrap items-center gap-1.5" method="get">
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            {sp.turno && <input type="hidden" name="turno" value={sp.turno} />}
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)]"
              aria-label={t("dateFrom")}
            />
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)]"
              aria-label={t("dateTo")}
            />
            <button
              type="submit"
              className="text-xs px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--ad-accent)] text-white hover:bg-[var(--ad-accent-hover)] transition-colors"
            >
              {t("applyFilter")}
            </button>
          </form>

          {/* Search */}
          <form className="flex items-center gap-1.5 ml-auto" method="get">
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            {sp.turno && <input type="hidden" name="turno" value={sp.turno} />}
            {sp.from && <input type="hidden" name="from" value={sp.from} />}
            {sp.to && <input type="hidden" name="to" value={sp.to} />}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ad-text-subtle)]" />
              <input
                type="search"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Cerca…"
                className="text-xs pl-7 pr-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] w-40"
              />
            </div>
            <button type="submit" className="sr-only">Cerca</button>
          </form>
        </div>

        {/* Clear filters */}
        {(sp.from || sp.to || sp.q || sp.status || sp.turno) && (
          <div className="mt-2 text-xs">
            <Link
              href="/admin/iscrizioni"
              className="text-[var(--ad-text-subtle)] hover:text-[var(--ad-accent)] underline"
            >
              {t("clearFilter")}
            </Link>
          </div>
        )}
      </div>

      {/* Optional bulk email per turno */}
      {sp.turno && (
        <div>
          <BulkEmailButton turnoId={sp.turno} />
        </div>
      )}

      {/* Empty state */}
      {iscrizioni.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[var(--ad-border)] rounded-[var(--radius-md)]">
          <p className="text-sm text-[var(--ad-text-muted)]">{t("noResults")}</p>
        </div>
      ) : (
        <>
          {/* Range label */}
          <p className="text-xs text-[var(--ad-text-muted)]">
            {t("showing")} {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} {t("of")} {total} {t("results")}
          </p>

          {/* Table */}
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)]">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="bg-[var(--ad-bg-sunken)] border-b border-[var(--ad-border)] text-left">
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    {t("name")}
                  </th>
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    {t("email")}
                  </th>
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    {t("phone")}
                  </th>
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    {t("campo")}
                  </th>
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    {t("age")}
                  </th>
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    {t("payments")}
                  </th>
                  <th scope="col" className="p-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    Ricevute
                  </th>
                  <th scope="col" className="p-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-subtle)]">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {iscrizioni.map((i) => {
                  const age = i.birthDate ? calcAge(i.birthDate, campStart) : (i.age ?? null);
                  const pendingReceipts = i.receiptUploads.filter((r) => !r.approvedAt && !r.rejectionReason).length;
                  return (
                    <tr key={i.id} className="border-b border-[var(--ad-border)] last:border-0 hover:bg-[var(--ad-bg-sunken)]/50">
                      <td className="p-3">
                        <div className="font-semibold text-[var(--ad-text)]">
                          {i.firstName} {i.lastName}
                        </div>
                        {i.isMinor && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--ad-warning-soft)] text-[var(--ad-warning)]">
                            {t("minor")}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[var(--ad-text-muted)]">
                        {i.email ? (
                          <a href={`mailto:${i.email}`} className="hover:text-[var(--ad-accent)]">
                            {i.email}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-[var(--ad-text-muted)]">
                        {i.phone ? (
                          <a href={`tel:${i.phone}`} className="hover:text-[var(--ad-accent)]">
                            {i.phone}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-[var(--ad-text-muted)] font-mono text-xs">
                        C{i.turno.number}
                      </td>
                      <td className="p-3 text-[var(--ad-text-muted)] tabular-nums">
                        {age ?? "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] ${
                              i.feePaid
                                ? "bg-[var(--ad-success-soft)] text-[var(--ad-success)]"
                                : "bg-[var(--ad-danger-soft)] text-[var(--ad-danger)]"
                            }`}
                            title={t("fee100")}
                          >
                            {i.feePaid ? "✓" : "○"} 100€
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] ${
                              i.balancePaid
                                ? "bg-[var(--ad-success-soft)] text-[var(--ad-success)]"
                                : "bg-[var(--ad-bg-sunken)] text-[var(--ad-text-subtle)]"
                            }`}
                            title={t("balance")}
                          >
                            {i.balancePaid ? "✓" : "○"} Saldo
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {i.receiptUploads.length === 0 ? (
                          <span className="text-xs text-[var(--ad-text-subtle)]">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] ${
                              pendingReceipts > 0
                                ? "bg-[var(--ad-warning-soft)] text-[var(--ad-warning)]"
                                : "bg-[var(--ad-success-soft)] text-[var(--ad-success)]"
                            }`}
                          >
                            {i.receiptUploads.length} file
                            {pendingReceipts > 0 && ` · ${pendingReceipts} da approvare`}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <IscrizioneDetailPanel
                          canApproveReceipts={true}
                          canEditAll={session.role === "superadmin"}
                          iscrizione={{
                            id: i.id,
                            firstName: i.firstName,
                            lastName: i.lastName,
                            birthDate: i.birthDate ? i.birthDate.toISOString() : null,
                            age: i.age,
                            email: i.email,
                            phone: i.phone,
                            isMinor: i.isMinor,
                            guardianName: i.guardianName,
                            guardianEmail: i.guardianEmail,
                            guardianPhone: i.guardianPhone,
                            guardianConsent: i.guardianConsent,
                            allergies: i.allergies,
                            medications: i.medications,
                            swimmingAbility: i.swimmingAbility,
                            tetanusStatus: i.tetanusStatus,
                            fitnessSelf: i.fitnessSelf,
                            dietaryNeeds: i.dietaryNeeds,
                            dietaryNotes: i.dietaryNotes,
                            tshirtSize: i.tshirtSize,
                            arrivalMode: i.arrivalMode,
                            arrivalTime: i.arrivalTime,
                            departureTime: i.departureTime,
                            status: i.status,
                            feePaid: i.feePaid,
                            feePaidDate: i.feePaidDate?.toISOString() ?? null,
                            balancePaid: i.balancePaid,
                            balancePaidDate: i.balancePaidDate?.toISOString() ?? null,
                            notes: i.notes,
                            imageDataConsent: i.imageDataConsent,
                            marketingConsent: i.marketingConsent,
                            privacyConsent: i.privacyConsent,
                            turnoNumber: i.turno.number,
                            turnoStart: i.turno.startDate.toISOString(),
                            turnoEnd: i.turno.endDate.toISOString(),
                            extraTurnoNumbers: i.iscrizioneTurni
                              .filter((it) => !it.isPrimary)
                              .map((it) => it.turno.number),
                            createdAt: i.createdAt.toISOString(),
                            receiptUploads: i.receiptUploads.map((r) => ({
                              id: r.id,
                              type: r.type as "deposit" | "balance",
                              originalName: r.originalName,
                              mimeType: r.mimeType,
                              byteSize: r.byteSize,
                              approvedAt: r.approvedAt?.toISOString() ?? null,
                              approvedBy: r.approvedBy,
                              rejectionReason: r.rejectionReason,
                              createdAt: r.createdAt.toISOString()
                            }))
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="flex items-center justify-between gap-3 flex-wrap"
              aria-label={t("page")}
            >
              <p className="text-xs text-[var(--ad-text-muted)]">
                {t("page")} {safePage} {t("of")} {totalPages}
              </p>
              <div className="flex items-center gap-1">
                {safePage > 1 ? (
                  <Link
                    href={buildHref(safePage - 1)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
                  >
                    <ChevronLeft size={14} /> {t("previous")}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] opacity-40 cursor-not-allowed">
                    <ChevronLeft size={14} /> {t("previous")}
                  </span>
                )}
                {safePage < totalPages ? (
                  <Link
                    href={buildHref(safePage + 1)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg-elevated)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)]"
                  >
                    {t("next")} <ChevronRight size={14} />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] opacity-40 cursor-not-allowed">
                    {t("next")} <ChevronRight size={14} />
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}