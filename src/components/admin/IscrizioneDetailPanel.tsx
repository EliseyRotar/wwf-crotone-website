"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { X, Printer, ExternalLink, Check, Loader2 } from "lucide-react";
import { calcAge } from "@/lib/turns";
import { useRouter } from "next/navigation";

/**
 * Map a raw DB enum value to its Italian label. Falls back to the raw
 * value if no translation is defined (e.g. for free-text entries like
 * fitnessSelf) so we never show a raw key to a non-technical admin.
 */
function translateEnum(
  t: ReturnType<typeof useTranslations>,
  namespace: string,
  value: string | null | undefined
): string {
  if (!value) return "—";
  try {
    // next-intl throws when the namespace path is missing; we wrap in
    // try/catch and fall back to the raw value rather than crashing
    // the detail panel on a partially-translated field.
    const label = t(`${namespace}.${value}` as never);
    // If the key was missing, next-intl returns the path itself (e.g.
    // "Admin.volunteer.swimValues.confident"). Detect that and fall
    // back to the raw value.
    if (typeof label === "string" && label.includes(`${value}`) && label.startsWith("Admin")) {
      return value;
    }
    return label;
  } catch {
    return value;
  }
}

export type IscrizioneDetail = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  age: number | null;
  email: string;
  phone: string;
  isMinor: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  guardianConsent: boolean;
  allergies: string | null;
  medications: string | null;
  swimmingAbility: string | null;
  tetanusStatus: string | null;
  fitnessSelf: string | null;
  dietaryNeeds: string | null;
  dietaryNotes: string | null;
  tshirtSize: string | null;
  arrivalMode: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  status: string;
  feePaid: boolean;
  feePaidDate: string | null;
  balancePaid: boolean;
  balancePaidDate: string | null;
  notes: string | null;
  imageDataConsent: boolean;
  marketingConsent: boolean;
  privacyConsent: boolean;
  turnoNumber: number;
  turnoStart: string;
  turnoEnd: string;
  extraTurnoNumbers: number[];
  createdAt: string;
  receiptUploads: ReceiptUpload[];
};

export type ReceiptUpload = {
  id: string;
  type: "deposit" | "balance";
  originalName: string;
  mimeType: string;
  byteSize: number;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "statusPending",
  email_verified: "statusPending",
  receipt_uploaded: "statusPending",
  confirmed: "statusConfirmed",
  paid: "statusPaid",
  waitlist: "statusWaitlist",
  cancelled: "statusCancelled"
};

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function Row({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)] gap-2 sm:gap-3 py-2 border-b border-[var(--ad-border)] text-sm">
      <span className="text-[var(--ad-text-subtle)] text-[11px] uppercase tracking-wider pt-0.5 truncate">
        {label}
      </span>
      <span className={warn ? "text-[var(--ad-danger)] font-medium break-words" : "text-[var(--ad-text)] break-words"}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="font-head text-xs uppercase tracking-wider text-[var(--ad-text-muted)] mb-2">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

/**
 * Inline-editable form field. In read-only mode it renders a value
 * with a label, just like <Row>. In edit mode it renders the right
 * input (text / select / checkbox) bound to the local `draft` state.
 *
 * The field is identified by a Prisma column name. The `options`
 * prop is required for enum fields so we can render a <select>; the
 * label for each option is resolved through `translateEnum` so the
 * stored enum code never reaches the user.
 */
function EditField({
  label,
  field,
  type = "text",
  options,
  isEditing,
  draft,
  onChange
}: {
  label: string;
  field: string;
  type?: "text" | "date" | "select" | "checkbox" | "textarea";
  options?: { value: string; label: string }[];
  isEditing: boolean;
  draft: Record<string, string | boolean | null>;
  onChange: (field: string, value: string | boolean | null) => void;
}) {
  if (!isEditing) return null;
  const value = draft[field] ?? null;
  const baseInput =
    "w-full text-sm rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg)] px-2.5 py-1.5 text-[var(--ad-text)] focus:border-[var(--ad-accent)] focus:outline-none";

  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)] gap-2 sm:gap-3 py-2 border-b border-[var(--ad-border)] text-sm">
      <label htmlFor={`edit-${field}`} className="text-[var(--ad-text-subtle)] text-[11px] uppercase tracking-wider pt-1.5 truncate">
        {label}
      </label>
      <div className="text-[var(--ad-text)]">
        {type === "select" && options ? (
          <select
            id={`edit-${field}`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field, e.target.value || null)}
            className={baseInput}
          >
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : type === "checkbox" ? (
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(field, e.target.checked)}
              className="h-4 w-4 rounded border-[var(--ad-border)]"
            />
            <span className="text-sm text-[var(--ad-text-muted)]">{value ? "Sì" : "No"}</span>
          </label>
        ) : type === "textarea" ? (
          <textarea
            id={`edit-${field}`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field, e.target.value)}
            className={baseInput + " min-h-[80px]"}
            rows={3}
          />
        ) : type === "date" ? (
          <input
            id={`edit-${field}`}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field, e.target.value || null)}
            className={baseInput}
          />
        ) : (
          <input
            id={`edit-${field}`}
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field, e.target.value)}
            className={baseInput}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Resolve a set of <option> items for a given enum namespace, with
 * each value mapped to its i18n label.
 */
function enumOptions(
  t: ReturnType<typeof useTranslations>,
  namespace: string,
  keys: string[]
): { value: string; label: string }[] {
  return keys.map((value) => ({
    value,
    label: translateEnum(t, namespace, value)
  }));
}

export default function IscrizioneDetailPanel({
  iscrizione,
  canApproveReceipts,
  canEditAll
}: {
  iscrizione: IscrizioneDetail;
  canApproveReceipts: boolean;
  canEditAll: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"fee" | "balance" | "status" | "receipt" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Local edit-form state. Initialised from the iscrizione prop; on save
  // we PATCH only the changed fields and let the server response trigger
  // a router.refresh() that re-feeds us new server state.
  const [draft, setDraft] = useState<Record<string, string | boolean | null>>({});
  const router = useRouter();
  const t = useTranslations("Admin.volunteer");
  const tIsc = useTranslations("Admin.iscrizioni");
  const locale = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);

  const campStart = new Date("2026-06-21");
  const birth = iscrizione.birthDate ? new Date(iscrizione.birthDate) : null;
  const age = birth ? calcAge(birth, campStart) : (iscrizione.age ?? null);

  const dateLocale = locale === "it" ? "it-IT" : "en-GB";
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString(dateLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  const fmtBytes = (n: number) =>
    n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

  // Lock body scroll + ESC close + focus trap
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Sync URL hash so the panel deep-links (#iscrizione-<id>)
  useEffect(() => {
    if (open) {
      const hash = `#iscrizione-${iscrizione.id}`;
      if (window.location.hash !== hash) {
        history.replaceState(null, "", hash);
      }
    }
  }, [open, iscrizione.id]);

  // Open if URL has the hash on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#iscrizione-${iscrizione.id}`) {
      setOpen(true);
    }
  }, [iscrizione.id]);

  const close = () => {
    setOpen(false);
    if (typeof window !== "undefined" && window.location.hash === `#iscrizione-${iscrizione.id}`) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  const patchIscrizione = async (body: Record<string, unknown>) => {
    setBusy(body.feePaid !== undefined ? "fee" : body.balancePaid !== undefined ? "balance" : "status");
    setError(null);
    try {
      const resp = await fetch("/api/admin/iscrizioni", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: iscrizione.id, ...body })
      });
      if (!resp.ok) throw new Error(await resp.text());
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(tIsc("networkError"));
    } finally {
      setBusy(null);
    }
  };

  const approveReceipt = async (receiptId: string) => {
    setBusy("receipt");
    setError(null);
    try {
      const resp = await fetch("/api/admin/iscrizioni/receipt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId, action: "approve" })
      });
      if (!resp.ok) throw new Error(await resp.text());
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(tIsc("receiptUploadError"));
    } finally {
      setBusy(null);
    }
  };

  const rejectReceipt = async (receiptId: string) => {
    setBusy("receipt");
    setError(null);
    try {
      const resp = await fetch("/api/admin/iscrizioni/receipt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId, action: "reject" })
      });
      if (!resp.ok) throw new Error(await resp.text());
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(tIsc("receiptUploadError"));
    } finally {
      setBusy(null);
    }
  };

  const startEdit = () => {
    // Snapshot the current iscrizione values into the local draft.
    setDraft({
      firstName: iscrizione.firstName,
      lastName: iscrizione.lastName,
      email: iscrizione.email,
      phone: iscrizione.phone,
      birthDate: iscrizione.birthDate ? iscrizione.birthDate.slice(0, 10) : null,
      isMinor: iscrizione.isMinor,
      guardianName: iscrizione.guardianName ?? null,
      guardianEmail: iscrizione.guardianEmail ?? null,
      guardianPhone: iscrizione.guardianPhone ?? null,
      guardianConsent: iscrizione.guardianConsent,
      allergies: iscrizione.allergies ?? null,
      medications: iscrizione.medications ?? null,
      swimmingAbility: iscrizione.swimmingAbility ?? null,
      tetanusStatus: iscrizione.tetanusStatus ?? null,
      fitnessSelf: iscrizione.fitnessSelf ?? null,
      dietaryNeeds: iscrizione.dietaryNeeds ?? null,
      dietaryNotes: iscrizione.dietaryNotes ?? null,
      tshirtSize: iscrizione.tshirtSize ?? null,
      arrivalMode: iscrizione.arrivalMode ?? null,
      arrivalTime: iscrizione.arrivalTime ?? null,
      departureTime: iscrizione.departureTime ?? null
    });
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
    setError(null);
  };

  const saveEdit = async () => {
    setBusy("edit");
    setError(null);
    try {
      const resp = await fetch("/api/admin/iscrizioni", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: iscrizione.id, ...draft })
      });
      const json = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string; rejected?: Record<string, string> };
      if (!resp.ok || !json.ok) {
        setError(json.error || tIsc("networkError"));
        return;
      }
      setEditing(false);
      setDraft({});
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(tIsc("networkError"));
    } finally {
      setBusy(null);
    }
  };

  const setField = (field: string, value: string | boolean | null) => {
    setDraft((cur) => ({ ...cur, [field]: value }));
  };

  const printRecord = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const title = t("printDocumentTitle", { firstName: iscrizione.firstName, lastName: iscrizione.lastName, number: iscrizione.turnoNumber });
    const yesLabel = t("yes");
    const noLabel = t("no");
    w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#0a0a0a}h1{font-size:24px;margin:0 0 8px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#52525b;border-bottom:1px solid #e4e4e7;padding-bottom:4px;margin:24px 0 8px}.row{display:flex;gap:12px;padding:4px 0;border-bottom:1px solid #f4f4f5;font-size:14px}.label{min-width:160px;font-weight:600;color:#71717a;text-transform:uppercase;font-size:11px;letter-spacing:.04em}.red{color:#dc2626}</style></head><body>`);
    w.document.write(`<h1>${esc(title)}</h1>`);
    w.document.write(`<p>${age ?? ""} · ${esc(t("printHeader"))}</p>`);
    w.document.write(`<h2>${esc(t("printSections.contacts"))}</h2>`);
    w.document.write(`<div class="row"><span class="label">${esc(t("printLabels.email"))}</span><span>${esc(iscrizione.email)}</span></div>`);
    w.document.write(`<div class="row"><span class="label">${esc(t("printLabels.phone"))}</span><span>${esc(iscrizione.phone)}</span></div>`);
    if (birth) {
      w.document.write(`<div class="row"><span class="label">${esc(t("birthDate"))}</span><span>${esc(fmtDate(birth.toISOString()))}</span></div>`);
    }
    w.document.write(`<h2>${esc(t("printSections.health"))}</h2>`);
    if (iscrizione.allergies) w.document.write(`<div class="row"><span class="label">${esc(t("allergies"))}</span><span class="red">${esc(iscrizione.allergies)}</span></div>`);
    if (iscrizione.swimmingAbility) w.document.write(`<div class="row"><span class="label">${esc(t("swimming"))}</span><span>${esc(iscrizione.swimmingAbility)}</span></div>`);
    if (iscrizione.tetanusStatus) w.document.write(`<div class="row"><span class="label">${esc(t("tetanus"))}</span><span>${esc(iscrizione.tetanusStatus)}</span></div>`);
    w.document.write(`<h2>${esc(t("printSections.payments"))}</h2>`);
    w.document.write(`<div class="row"><span class="label">${esc(t("printLabels.quota"))}</span><span>${iscrizione.feePaid ? yesLabel : noLabel}${iscrizione.feePaidDate ? ` (${esc(fmtDate(iscrizione.feePaidDate))})` : ""}</span></div>`);
    w.document.write(`<div class="row"><span class="label">${esc(t("printLabels.balance"))}</span><span>${iscrizione.balancePaid ? yesLabel : noLabel}${iscrizione.balancePaidDate ? ` (${esc(fmtDate(iscrizione.balancePaidDate))})` : ""}</span></div>`);
    w.document.write(`<p style="margin-top:32px;font-size:11px;color:#71717a">${esc(t("printFooter", { date: new Date().toLocaleString(dateLocale) }))}</p>`);
    w.document.write(`</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={tIsc("openPanel")}
        title={tIsc("openPanel")}
        className="inline-flex items-center justify-center w-7 h-7 text-[var(--ad-text-muted)] hover:text-[var(--ad-accent)] transition-colors"
      >
        <ExternalLink size={15} />
      </button>
    );
  }

  const yesLabel = t("yes");
  const noLabel = t("no");
  const isMultiTurn = iscrizione.extraTurnoNumbers.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex" role="dialog" aria-modal="true" aria-label={`${iscrizione.firstName} ${iscrizione.lastName}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        onClick={close}
        aria-hidden="true"
      />

      {/* Slide-in panel — right side, full height */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative ml-auto w-full max-w-xl h-full bg-[var(--ad-bg-elevated)] border-l border-[var(--ad-border)] flex flex-col animate-[slide-in-right_240ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Header */}
        <header className="px-4 sm:px-6 py-4 border-b border-[var(--ad-border)] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-head text-2xl text-[var(--ad-text)] truncate">
                  {iscrizione.firstName} {iscrizione.lastName}
                </h2>
                {iscrizione.isMinor && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--ad-warning-soft)] text-[var(--ad-warning)]">
                    {tIsc("minor")}
                  </span>
                )}
                {isMultiTurn && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--ad-accent-soft)] text-[var(--ad-accent)]">
                    multi-turno
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--ad-text-muted)]">
                {t("camp", { number: iscrizione.turnoNumber })} · {fmtDate(iscrizione.turnoStart)} → {fmtDate(iscrizione.turnoEnd)}
                {age !== null && ` · ${t("printAge", { age })}`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canEditAll && !editing && (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--ad-border)] text-[var(--ad-text)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors"
                >
                  {t("editTitle")}
                </button>
              )}
              <button
                onClick={printRecord}
                aria-label={t("printAria")}
                title={t("printTitle")}
                className="p-2 text-[var(--ad-text-muted)] hover:text-[var(--ad-text)] transition-colors rounded-[var(--radius-sm)]"
              >
                <Printer size={18} />
              </button>
              <button
                onClick={close}
                aria-label={tIsc("closePanel")}
                className="p-2 text-[var(--ad-text-muted)] hover:text-[var(--ad-text)] transition-colors rounded-[var(--radius-sm)]"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Status pill + image-consent warning */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--ad-bg-sunken)] text-[var(--ad-text-muted)]">
              {tIsc(STATUS_LABELS[iscrizione.status] ?? "statusPending")}
            </span>
            {!iscrizione.imageDataConsent && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--ad-danger-soft)] text-[var(--ad-danger)]">
                {tIsc("noImageConsent")}
              </span>
            )}
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-2">
          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--ad-danger-soft)] border border-[var(--ad-danger)]/30 text-sm text-[var(--ad-danger)]">
              {error}
            </div>
          )}

          {/* Payments + receipt approval (Phase 2) */}
          <Section title={tIsc("payments")}>
            <Row
              label={tIsc("fee100")}
              value={
                <div className="flex items-center gap-2">
                  <span className={iscrizione.feePaid ? "text-[var(--ad-success)]" : "text-[var(--ad-danger)]"}>
                    {iscrizione.feePaid ? `✓ ${tIsc("feePaid")}` : `○ ${tIsc("quotaNotPaid")}`}
                  </span>
                  {iscrizione.feePaidDate && (
                    <span className="text-xs text-[var(--ad-text-subtle)] font-mono">
                      {fmtDate(iscrizione.feePaidDate)}
                    </span>
                  )}
                  <button
                    onClick={() => patchIscrizione({ feePaid: !iscrizione.feePaid })}
                    disabled={busy !== null}
                    className="ml-auto text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors disabled:opacity-50"
                  >
                    {busy === "fee" ? <Loader2 size={12} className="inline animate-spin" /> : iscrizione.feePaid ? "Rimuovi" : "Conferma"}
                  </button>
                </div>
              }
            />
            <Row
              label={tIsc("balance")}
              value={
                <div className="flex items-center gap-2">
                  <span className={iscrizione.balancePaid ? "text-[var(--ad-success)]" : "text-[var(--ad-danger)]"}>
                    {iscrizione.balancePaid ? `✓ ${tIsc("balancePaid")}` : `○ ${tIsc("balanceNotPaid")}`}
                  </span>
                  {iscrizione.balancePaidDate && (
                    <span className="text-xs text-[var(--ad-text-subtle)] font-mono">
                      {fmtDate(iscrizione.balancePaidDate)}
                    </span>
                  )}
                  <button
                    onClick={() => patchIscrizione({ balancePaid: !iscrizione.balancePaid })}
                    disabled={busy !== null}
                    className="ml-auto text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors disabled:opacity-50"
                  >
                    {busy === "balance" ? <Loader2 size={12} className="inline animate-spin" /> : iscrizione.balancePaid ? "Rimuovi" : "Conferma"}
                  </button>
                </div>
              }
            />
          </Section>

          {/* Receipts (Phase 2) */}
          <Section title={tIsc("receipts")}>
            {iscrizione.receiptUploads.length === 0 ? (
              <p className="text-sm text-[var(--ad-text-subtle)] py-2">{tIsc("noReceipts")}</p>
            ) : (
              <ul className="space-y-2">
                {iscrizione.receiptUploads.map((r) => (
                  <li
                    key={r.id}
                    className="p-3 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {r.type === "deposit" ? tIsc("receiptDeposit") : tIsc("receiptBalance")}
                        </p>
                        <p className="text-xs text-[var(--ad-text-subtle)] font-mono truncate">
                          {r.originalName} · {fmtBytes(r.byteSize)} · {r.mimeType}
                        </p>
                        <p className="text-xs text-[var(--ad-text-muted)] mt-0.5">
                          {tIsc("receiptUploadedOn", { date: fmtDate(r.createdAt) })}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] shrink-0 ${
                          r.approvedAt
                            ? "bg-[var(--ad-success-soft)] text-[var(--ad-success)]"
                            : r.rejectionReason
                            ? "bg-[var(--ad-danger-soft)] text-[var(--ad-danger)]"
                            : "bg-[var(--ad-warning-soft)] text-[var(--ad-warning)]"
                        }`}
                      >
                        {r.approvedAt
                          ? tIsc("receiptApproved")
                          : r.rejectionReason
                          ? tIsc("receiptRejected")
                          : tIsc("receiptPendingReview")}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <a
                        href={`/api/admin/iscrizioni/receipt/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors"
                      >
                        {tIsc("viewReceipt")}
                      </a>
                      {canApproveReceipts && !r.approvedAt && (
                        <>
                          <button
                            onClick={() => approveReceipt(r.id)}
                            disabled={busy === "receipt"}
                            className="text-xs px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--ad-success)] text-white hover:bg-[var(--ad-success)]/90 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {busy === "receipt" ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            {tIsc("approveReceipt")}
                          </button>
                          <button
                            onClick={() => rejectReceipt(r.id)}
                            disabled={busy === "receipt"}
                            className="text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] hover:border-[var(--ad-danger)] hover:text-[var(--ad-danger)] transition-colors disabled:opacity-50"
                          >
                            {tIsc("rejectReceipt")}
                          </button>
                        </>
                      )}
                      {r.approvedAt && (
                        <span className="text-xs text-[var(--ad-text-subtle)]">
                          {tIsc("receiptApprovedOn", { date: fmtDate(r.approvedAt) })}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Contacts */}
          <Section title={t("contacts")}>
            {editing ? (
              <>
                <EditField label={tIsc("email")} field="email" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={tIsc("phone")} field="phone" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("birthDate")} field="birthDate" type="date" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("field.isMinor")} field="isMinor" type="checkbox" isEditing={editing} draft={draft} onChange={setField} />
              </>
            ) : (
              <>
                <Row label={tIsc("email")} value={<a href={`mailto:${iscrizione.email}`} className="text-[var(--ad-accent)] hover:underline">{iscrizione.email}</a>} />
                <Row label={tIsc("phone")} value={<a href={`tel:${iscrizione.phone}`} className="text-[var(--ad-accent)] hover:underline">{iscrizione.phone || "—"}</a>} />
                <Row label={t("birthDate")} value={birth ? fmtDate(birth.toISOString()) : "—"} />
              </>
            )}
          </Section>

          {/* Guardian */}
          {(iscrizione.isMinor || editing) && (
            <Section title={t("guardian")}>
              {editing ? (
                <>
                  <EditField label={t("guardianName")} field="guardianName" isEditing={editing} draft={draft} onChange={setField} />
                  <EditField label={t("guardianEmail")} field="guardianEmail" isEditing={editing} draft={draft} onChange={setField} />
                  <EditField label={t("guardianPhone")} field="guardianPhone" isEditing={editing} draft={draft} onChange={setField} />
                  <EditField label={t("guardianConsent")} field="guardianConsent" type="checkbox" isEditing={editing} draft={draft} onChange={setField} />
                </>
              ) : (
                <>
                  <Row label={t("guardianName")} value={iscrizione.guardianName ?? "—"} />
                  <Row label={t("guardianEmail")} value={iscrizione.guardianEmail ?? "—"} />
                  <Row label={t("guardianPhone")} value={iscrizione.guardianPhone ?? "—"} />
                  <Row label={t("guardianConsent")} value={iscrizione.guardianConsent ? t("signed") : t("missing")} warn={!iscrizione.guardianConsent} />
                </>
              )}
            </Section>
          )}

          {/* Health */}
          <Section title={t("health")}>
            {editing ? (
              <>
                <EditField label={t("allergies")} field="allergies" type="textarea" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("medications")} field="medications" type="textarea" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("swimming")} field="swimmingAbility" type="select" options={enumOptions(t, "swimValues", ["none", "basic", "confident"])} isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("tetanus")} field="tetanusStatus" type="select" options={enumOptions(t, "tetanusValues", ["unknown", "vaccinated", "not_vaccinated"])} isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("fitness")} field="fitnessSelf" isEditing={editing} draft={draft} onChange={setField} />
              </>
            ) : (
              <>
                <Row label={t("allergies")} value={iscrizione.allergies} warn={!!iscrizione.allergies} />
                <Row label={t("medications")} value={iscrizione.medications} />
                <Row label={t("swimming")} value={translateEnum(t, "swimValues", iscrizione.swimmingAbility)} />
                <Row label={t("tetanus")} value={translateEnum(t, "tetanusValues", iscrizione.tetanusStatus)} />
                <Row label={t("fitness")} value={iscrizione.fitnessSelf} />
              </>
            )}
          </Section>

          {/* Diet */}
          <Section title={t("diet")}>
            {editing ? (
              <>
                <EditField label={t("dietaryNeeds")} field="dietaryNeeds" type="select" options={enumOptions(t, "dietValues", ["none", "vegetarian", "vegan", "celiac", "other"])} isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("dietaryNotes")} field="dietaryNotes" type="textarea" isEditing={editing} draft={draft} onChange={setField} />
              </>
            ) : (
              <>
                <Row label={t("dietaryNeeds")} value={translateEnum(t, "dietValues", iscrizione.dietaryNeeds)} />
                <Row label={t("dietaryNotes")} value={iscrizione.dietaryNotes} />
              </>
            )}
          </Section>

          {/* Logistics */}
          <Section title={t("logistics")}>
            {editing ? (
              <>
                <EditField label={t("arrivalMode")} field="arrivalMode" type="select" options={enumOptions(t, "arrivalValues", ["own_car", "train", "bus", "plane_crotone", "plane_lamezia", "need_pickup"])} isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("arrivalTime")} field="arrivalTime" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("departureTime")} field="departureTime" isEditing={editing} draft={draft} onChange={setField} />
                <EditField label={t("tshirtSize")} field="tshirtSize" type="select" options={["S", "M", "L", "XL", "XXL"].map((v) => ({ value: v, label: v }))} isEditing={editing} draft={draft} onChange={setField} />
              </>
            ) : (
              <>
                <Row label={t("arrivalMode")} value={translateEnum(t, "arrivalValues", iscrizione.arrivalMode)} />
                <Row label={t("arrivalTime")} value={iscrizione.arrivalTime} />
                <Row label={t("departureTime")} value={iscrizione.departureTime} />
                <Row label={t("tshirtSize")} value={iscrizione.tshirtSize} />
              </>
            )}
            {isMultiTurn && (
              <Row
                label={t("extraTurnsField")}
                value={iscrizione.extraTurnoNumbers.map((n) => t("camp", { number: n })).join(", ")}
              />
            )}
          </Section>

          {/* Consents */}
          <Section title={t("consents")}>
            <Row label={t("privacy")} value={iscrizione.privacyConsent ? yesLabel : noLabel} warn={!iscrizione.privacyConsent} />
            <Row label={t("marketing")} value={iscrizione.marketingConsent ? yesLabel : noLabel} />
            <Row label={t("images")} value={iscrizione.imageDataConsent ? yesLabel : noLabel} warn={!iscrizione.imageDataConsent} />
          </Section>

          {/* Admin notes */}
          <Section title={t("adminNotes")}>
            {editing ? (
              <EditField label={t("notes")} field="notes" type="textarea" isEditing={editing} draft={draft} onChange={setField} />
            ) : (
              <Row label={t("notes")} value={iscrizione.notes} />
            )}
            <Row label={t("registeredOn")} value={fmtDate(iscrizione.createdAt)} />
          </Section>

          {/* Edit save/cancel bar — sticks to the bottom of the panel. */}
          {editing && (
            <div className="sticky bottom-0 left-0 right-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[var(--ad-bg-elevated)] border-t border-[var(--ad-border)] flex items-center justify-end gap-2">
              {error && (
                <span className="text-xs text-[var(--ad-danger)] mr-auto">{error}</span>
              )}
              <button
                onClick={cancelEdit}
                disabled={busy === "edit"}
                className="px-3 py-1.5 text-sm rounded-[var(--radius-sm)] border border-[var(--ad-border)] text-[var(--ad-text)] hover:border-[var(--ad-text-muted)] disabled:opacity-50"
              >
                {tIsc("cancel")}
              </button>
              <button
                onClick={saveEdit}
                disabled={busy === "edit"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-[var(--radius-sm)] bg-[var(--ad-accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === "edit" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {tIsc("saveChanges")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}