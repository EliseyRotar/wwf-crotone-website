"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Loader2, Lock } from "lucide-react";
import ReceiptUploader from "@/components/features/ReceiptUploader";

/* ---------- types ---------- */

type LockState = Record<string, "ok" | "personal-data-locked" | "turno-started">;

type Props = {
  iscrizioneId: string;
  initialValues: Record<string, string | boolean>;
  lockState: LockState;
  receiptSlot: "deposit" | "balance" | "complete" | "none";
  status: string;
  feePaid: boolean;
  balancePaid: boolean;
  depositReceiptApprovedAt: string | null;
  balanceReceiptApprovedAt: string | null;
  depositReceiptUploadedAt: string | null;
  balanceReceiptUploadedAt: string | null;
  locale: string;
  labels: Record<string, string>;
  sectionLabels: {
    anagrafica: string;
    salute: string;
    logistica: string;
    consensi: string;
    pagamento: string;
    save: string;
    saving: string;
    saved: string;
    saveError: string;
    lockedFieldsNotice: string;
    turnoStartedNotice: string;
    uploadReceipt: string;
    paymentComplete: string;
    pendingApproval: string;
    changeHistory: string;
    approved: string;
    fee100: string;
    balance: string;
    ibanHelp: string;
    balanceAmount: string;
    ibanLink: string;
  };
};

type SectionKey = "anagrafica" | "salute" | "logistica" | "consensi";

const SECTION_FIELDS: Record<SectionKey, readonly string[]> = {
  anagrafica: [
    "firstName",
    "lastName",
    "birthDate",
    "age",
    "email",
    "phone",
    "isMinor",
    "guardianName",
    "guardianEmail",
    "guardianPhone",
    "guardianConsent"
  ],
  salute: [
    "allergies",
    "medications",
    "swimmingAbility",
    "tetanusStatus",
    "fitnessSelf",
    "dietaryNeeds",
    "dietaryNotes",
    "tshirtSize"
  ],
  logistica: ["arrivalMode", "arrivalTime", "departureTime"],
  consensi: ["privacyConsent", "marketingConsent", "imageDataConsent"]
};

const ALL_SECTIONS: SectionKey[] = ["anagrafica", "salute", "logistica", "consensi"];

/* ---------- component ---------- */

export default function BookingDetailClient({
  iscrizioneId,
  initialValues,
  lockState,
  receiptSlot,
  status,
  feePaid,
  balancePaid,
  depositReceiptApprovedAt,
  balanceReceiptApprovedAt,
  depositReceiptUploadedAt,
  balanceReceiptUploadedAt,
  locale,
  labels,
  sectionLabels
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues);
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const turnoStarted = useMemo(
    () => Object.values(lockState).some((v) => v === "turno-started"),
    [lockState]
  );
  const personalLocked = useMemo(
    () => Object.values(lockState).some((v) => v === "personal-data-locked"),
    [lockState]
  );

  const set = useCallback((k: string, v: string | boolean) => {
    setValues((d) => ({ ...d, [k]: v }));
  }, []);

  /**
   * Compute the diff between the current values and the original
   * initialValues. Returns the subset of fields the user actually
   * changed — these are what we send to the API and what gets logged.
   */
  const diff = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(values)) {
      if (values[k] !== initialValues[k]) {
        out[k] = values[k];
      }
    }
    return out;
  }, [values, initialValues]);

  const isDirty = Object.keys(diff).length > 0;

  async function onSave() {
    if (turnoStarted) return;
    if (!isDirty) return;
    setBusy((b) => ({ ...b, _all: true }));
    setErrors({});
    try {
      const res = await fetch(`/api/account/booking/${iscrizioneId}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fields: diff, locale })
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        saved?: string[];
        rejected?: string[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErrors({ _all: json.error ?? "server" });
        return;
      }
      const saved = new Set(json.saved ?? Object.keys(diff));
      setSavedFields(saved);
      // Update initialValues baseline by replacing it with the saved
      // server-side state. The simplest way: re-fetch by calling
      // router.refresh() so the server re-renders with the new
      // initialValues, then sync the local state to the new baseline.
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrors({ _all: "network" });
    } finally {
      setBusy((b) => ({ ...b, _all: false }));
    }
  }

  return (
    <div className="space-y-6">
      {turnoStarted && (
        <div
          className="card border-2 border-ink-grey-light"
          role="status"
          data-testid="turno-started-notice"
        >
          <div className="card-body flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{sectionLabels.turnoStartedNotice}</p>
          </div>
        </div>
      )}
      {!turnoStarted && personalLocked && (
        <div
          className="card border border-ink-line"
          role="status"
          data-testid="personal-locked-notice"
        >
          <div className="card-body">
            <p className="text-sm text-ink-2">{sectionLabels.lockedFieldsNotice}</p>
          </div>
        </div>
      )}

      {ALL_SECTIONS.map((section) => {
        const fields = SECTION_FIELDS[section];
        const sectionLocked = fields.every((f) => lockState[f] !== "ok");
        return (
          <SectionCard
            key={section}
            title={sectionLabels[section]}
            locked={sectionLocked}
            save={sectionLabels.save}
            saving={sectionLabels.saving}
            onSave={onSave}
            dirty={fields.some((f) => f in diff)}
            busy={!!busy._all}
            savedFields={savedFields}
            disabled={turnoStarted}
            showSaveButton={!turnoStarted}
          >
            {fields.map((f) => {
              const lock = lockState[f] ?? "ok";
              const disabled = lock !== "ok";
              const wasSaved = savedFields.has(f);
              return (
                <FieldRow
                  key={f}
                  field={f}
                  value={values[f] ?? ""}
                  onChange={(v) => set(f, v)}
                  label={labels[f] ?? f}
                  disabled={disabled}
                  saved={wasSaved}
                  lockReason={lock !== "ok" ? lock : null}
                  lockedReasonText={
                    lock === "turno-started"
                      ? sectionLabels.turnoStartedNotice
                      : lock === "personal-data-locked"
                        ? sectionLabels.lockedFieldsNotice
                        : null
                  }
                />
              );
            })}
          </SectionCard>
        );
      })}

      {/* Pagamento + receipt slot */}
      <div className="card">
        <div className="card-body space-y-3">
          <h2 className="text-lg font-semibold">{sectionLabels.pagamento}</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <PaymentRow
              label={sectionLabels.fee100}
              paid={feePaid}
              approvedAt={depositReceiptApprovedAt}
              uploadedAt={depositReceiptUploadedAt}
              approvedLabel={sectionLabels.approved}
              pendingLabel={sectionLabels.pendingApproval}
            />
            <PaymentRow
              label={sectionLabels.balance}
              paid={balancePaid}
              approvedAt={balanceReceiptApprovedAt}
              uploadedAt={balanceReceiptUploadedAt}
              approvedLabel={sectionLabels.approved}
              pendingLabel={sectionLabels.pendingApproval}
            />
          </div>
          <div className="text-right">
            <Link
              className="text-sm underline text-ink-2"
              href={`/${locale}/account/bookings/${iscrizioneId}/receipts`}
            >
              {sectionLabels.uploadReceipt} →
            </Link>
          </div>

          {receiptSlot === "complete" && (
            <div className="rounded-md border border-wwf-green/40 bg-wwf-green/10 px-4 py-3 text-sm">
              ✓ {sectionLabels.paymentComplete}
            </div>
          )}

          {receiptSlot === "deposit" && status !== "cancelled" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-2">
                {sectionLabels.ibanHelp}{" "}
                <Link className="underline" href={`/${locale}/contact`}>
                  {sectionLabels.ibanLink}
                </Link>
                .
              </p>
              <ReceiptUploader
                iscrizioneId={iscrizioneId}
                type="deposit"
                onUploaded={() => router.refresh()}
              />
            </div>
          )}

          {receiptSlot === "balance" && status !== "cancelled" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-2">{sectionLabels.balanceAmount}</p>
              <ReceiptUploader
                iscrizioneId={iscrizioneId}
                type="balance"
                onUploaded={() => router.refresh()}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          className="text-sm text-ink-2 hover:underline"
          href={`/${locale}/account/bookings/${iscrizioneId}/history`}
        >
          {sectionLabels.changeHistory} →
        </Link>
        {!turnoStarted && (
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            onClick={onSave}
            disabled={!isDirty || !!busy._all}
            data-testid="save-button"
          >
            {busy._all && <Loader2 size={16} className="animate-spin" />}
            {busy._all ? sectionLabels.saving : sectionLabels.save}
          </button>
        )}
      </div>

      {errors._all && (
        <p className="text-sm text-tag-red" role="alert">
          {sectionLabels.saveError}: {errors._all}
        </p>
      )}
    </div>
  );
}

/* ---------- subcomponents ---------- */

function SectionCard({
  title,
  locked,
  children,
  showSaveButton,
  onSave,
  save,
  saving,
  busy,
  dirty,
  savedFields,
  disabled
}: {
  title: string;
  locked: boolean;
  children: React.ReactNode;
  showSaveButton: boolean;
  onSave: () => void;
  save: string;
  saving: string;
  busy: boolean;
  dirty: boolean;
  savedFields: Set<string>;
  disabled: boolean;
}) {
  return (
    <section className="card">
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {title}
            {locked && <Lock size={14} className="text-ink-grey" />}
          </h2>
          {showSaveButton && !disabled && (
            <button
              type="button"
              className="btn btn-secondary text-sm flex items-center gap-2"
              onClick={onSave}
              disabled={!dirty || busy}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? saving : save}
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">{children}</div>
        {savedFields.size > 0 && (
          <p className="text-xs text-tag-green">
            ✓ {Array.from(savedFields).length}
          </p>
        )}
      </div>
    </section>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  label,
  disabled,
  saved,
  lockReason,
  lockedReasonText
}: {
  field: string;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  label: string;
  disabled: boolean;
  saved: boolean;
  lockReason: "personal-data-locked" | "turno-started" | null;
  lockedReasonText: string | null;
}) {
  const isBool = typeof value === "boolean";
  const isTextarea = field === "allergies" || field === "medications" || field === "fitnessSelf" || field === "dietaryNotes";
  const isSelect =
    field === "swimmingAbility" ||
    field === "tetanusStatus" ||
    field === "dietaryNeeds" ||
    field === "tshirtSize" ||
    field === "arrivalMode";
  const isDate = field === "birthDate";
  const isTime = field === "arrivalTime" || field === "departureTime";

  return (
    <div className="field" data-field={field}>
      <label htmlFor={`f-${field}`} className="text-sm flex items-center gap-2">
        {label}
        {disabled && lockReason && (
          <span
            className="text-xs text-ink-grey"
            title={lockedReasonText ?? undefined}
            aria-label={lockedReasonText ?? undefined}
          >
            <Lock size={11} className="inline" />
          </span>
        )}
      </label>
      {isBool ? (
        <input
          id={`f-${field}`}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4"
        />
      ) : isTextarea ? (
        <textarea
          id={`f-${field}`}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base disabled:opacity-60"
        />
      ) : isSelect ? (
        <select
          id={`f-${field}`}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base disabled:opacity-60"
        >
          <option value="">—</option>
          {renderSelectOptions(field)}
        </select>
      ) : isDate ? (
        <input
          id={`f-${field}`}
          type="date"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base disabled:opacity-60"
        />
      ) : isTime ? (
        <input
          id={`f-${field}`}
          type="time"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base disabled:opacity-60"
        />
      ) : (
        <input
          id={`f-${field}`}
          type={
            field === "email"
              ? "email"
              : field === "phone" || field === "guardianPhone"
                ? "tel"
                : "text"
          }
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base disabled:opacity-60"
        />
      )}
      {saved && !disabled && (
        <p className="text-xs text-tag-green">✓</p>
      )}
    </div>
  );
}

function PaymentRow({
  label,
  paid,
  approvedAt,
  uploadedAt,
  approvedLabel,
  pendingLabel
}: {
  label: string;
  paid: boolean;
  approvedAt: string | null;
  uploadedAt: string | null;
  approvedLabel: string;
  pendingLabel: string;
}) {
  let status: React.ReactNode = "—";
  if (paid && approvedAt) status = <span className="text-tag-green">✓ {approvedLabel}</span>;
  else if (paid) status = <span className="text-tag-green">✓</span>;
  else if (uploadedAt) status = <span className="text-ink-2">{pendingLabel}</span>;
  return (
    <div className="rounded-md border border-ink-line p-2">
      <div className="text-xs text-ink-grey">{label}</div>
      <div className="font-medium">{status}</div>
    </div>
  );
}

function renderSelectOptions(field: string): React.ReactNode {
  switch (field) {
    case "swimmingAbility":
      return (
        <>
          <option value="none">none</option>
          <option value="basic">basic</option>
          <option value="confident">confident</option>
        </>
      );
    case "tetanusStatus":
      return (
        <>
          <option value="unknown">unknown</option>
          <option value="vaccinated">vaccinated</option>
          <option value="not_vaccinated">not_vaccinated</option>
        </>
      );
    case "dietaryNeeds":
      return (
        <>
          <option value="none">none</option>
          <option value="vegetarian">vegetarian</option>
          <option value="vegan">vegan</option>
          <option value="celiac">celiac</option>
          <option value="other">other</option>
        </>
      );
    case "tshirtSize":
      return (
        <>
          {["S", "M", "L", "XL", "XXL"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </>
      );
    case "arrivalMode":
      return (
        <>
          <option value="own_car">own_car</option>
          <option value="train">train</option>
          <option value="bus">bus</option>
          <option value="plane_crotone">plane_crotone</option>
          <option value="plane_lamezia">plane_lamezia</option>
          <option value="need_pickup">need_pickup</option>
        </>
      );
    default:
      return null;
  }
}
