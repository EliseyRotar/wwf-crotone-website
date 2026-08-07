"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { Eye, X, Printer } from "lucide-react";
import { calcAge } from "@/lib/turns";

type Iscrizione = {
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
};

const STATUS_COLORS: Record<string, string> = {
  pending: "tag-grey",
  confirmed: "tag-blue",
  paid: "tag-green",
  cancelled: "tag-red",
  waitlist: "tag-orange"
};

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function Row({ label, value, warn, yesLabel, noLabel }: { label: string; value: string | boolean | null | undefined; warn?: boolean; yesLabel: string; noLabel: string }) {
  if (value === null || value === undefined || value === "") return null;
  const display = value === true ? yesLabel : value === false ? noLabel : String(value);
  return (
    <div className="flex gap-2 py-1.5 border-b border-ink-grey-light/40 text-sm">
      <span className="font-bold text-ink-grey uppercase tracking-cta text-xs min-w-[140px] shrink-0 pt-0.5">{label}</span>
      <span className={warn ? "text-wwf-red font-semibold" : "text-ink-2"}>{display}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="font-head text-sm uppercase tracking-cta text-wwf-green mb-2 pb-1 border-b-2 border-wwf-green">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export default function ViewVolunteer({ iscrizione }: { iscrizione: Iscrizione }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Admin.volunteer");
  const tIsc = useTranslations("Admin.iscrizioni");
  const locale = useLocale();
  const statusKey = ({
    pending: "statusPending",
    confirmed: "statusConfirmed",
    paid: "statusPaid",
    waitlist: "statusWaitlist",
    cancelled: "statusCancelled"
  } as const)[iscrizione.status as keyof object] || "statusPending";
  const statusLabel = tIsc(statusKey);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
        }
        if (e.key === "Tab") {
          const root = document.getElementById("view-volunteer-modal");
          if (!root) return;
          const focusable = root.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener("keydown", onKey);
      const root = document.getElementById("view-volunteer-modal");
      const firstBtn = root?.querySelector<HTMLElement>("button");
      firstBtn?.focus();
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  const close = () => setOpen(false);

  const birth = iscrizione.birthDate ? new Date(iscrizione.birthDate) : null;
  const campStart = new Date("2026-06-21");
  let age: number | null = null;
  if (birth) {
    age = calcAge(birth, campStart);
  } else if (iscrizione.age !== null) {
    age = iscrizione.age;
  }
  const dateLocale = locale === "it" ? "it-IT" : "en-GB";
  const birthFormatted = birth ? birth.toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const yesLabel = t("yes");
  const noLabel = t("no");

  // Additional turns (M5: derived from IscrizioneTurno junction)
  const isMultiTurn = iscrizione.extraTurnoNumbers.length > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-ink hover:text-wwf-green p-1"
        aria-label={t("viewAria")}
        title={t("viewDetails")}
      >
        <Eye size={15} />
      </button>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        id="view-volunteer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("viewTitle", { firstName: iscrizione.firstName, lastName: iscrizione.lastName })}
        className="card bg-surface max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fixed, no scroll */}
        <div className="p-6 pb-4 border-b border-ink-grey-light shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-2xl">{iscrizione.firstName} {iscrizione.lastName}</h2>
                <span className={`tag ${STATUS_COLORS[iscrizione.status] || "tag-grey"}`}>
                  {statusLabel}
                </span>
                {iscrizione.isMinor && <span className="tag tag-orange">{t("minor")}</span>}
                {isMultiTurn && <span className="tag tag-blue">{t("multiTurn")}</span>}
              </div>
              <p className="text-sm text-ink-grey">
                {t("camp", { number: iscrizione.turnoNumber })} · {new Date(iscrizione.turnoStart).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" })} → {new Date(iscrizione.turnoEnd).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" })}
                {" · "}{age !== null ? t("printAge", { age }) : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const w = window.open("", "_blank", "width=800,height=900");
                  if (!w) return;
                  const title = t("printDocumentTitle", { firstName: iscrizione.firstName, lastName: iscrizione.lastName, number: iscrizione.turnoNumber });
                  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#101010}h1{font-size:24px;margin:0 0 8px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#007932;border-bottom:2px solid #007932;padding-bottom:4px;margin:24px 0 8px}.row{display:flex;gap:12px;padding:4px 0;border-bottom:1px solid #eee;font-size:14px}.label{min-width:160px;font-weight:600;color:#707070;text-transform:uppercase;font-size:11px;letter-spacing:.04em}.tag{display:inline-block;padding:2px 8px;border-radius:20px;background:#c9e8a0;color:#005a25;font-size:11px;font-weight:700;margin-right:4px}.red{color:#ed2b00}</style></head><body>`);
                  w.document.write(`<h1>${esc(title)}</h1>`);
                  w.document.write(`<p>${esc(String(age))} · ${esc(t("printHeader"))} <span class="tag">${esc(statusLabel)}</span>${iscrizione.isMinor ? ` <span class="tag" style="background:#f5d200;color:#101010">${esc(t("printMinor"))}</span>` : ''}</p>`);
                  w.document.write(`<h2>${esc(t("printSections.contacts"))}</h2>`);
                  w.document.write(`<div class="row"><span class="label">${esc(t("printLabels.email"))}</span><span>${esc(iscrizione.email)}</span></div>`);
                  w.document.write(`<div class="row"><span class="label">${esc(t("printLabels.phone"))}</span><span>${esc(iscrizione.phone)}</span></div>`);
                  if (iscrizione.isMinor) {
                    w.document.write(`<h2>${t("printSections.guardian")}</h2>`);
                    if (iscrizione.guardianName) w.document.write(`<div class="row"><span class="label">${t("printLabels.name")}</span><span>${esc(iscrizione.guardianName)}</span></div>`);
                    if (iscrizione.guardianEmail) w.document.write(`<div class="row"><span class="label">${t("printLabels.email")}</span><span>${esc(iscrizione.guardianEmail)}</span></div>`);
                    if (iscrizione.guardianPhone) w.document.write(`<div class="row"><span class="label">${t("printLabels.phone")}</span><span>${esc(iscrizione.guardianPhone)}</span></div>`);
                  }
                  w.document.write(`<h2>${t("printSections.health")}</h2>`);
                  if (iscrizione.allergies) w.document.write(`<div class="row"><span class="label">${t("printLabels.allergies")}</span><span class="red">${esc(iscrizione.allergies)}</span></div>`);
                  if (iscrizione.swimmingAbility) w.document.write(`<div class="row"><span class="label">${t("printLabels.swim")}</span><span>${t(`swimValues.${iscrizione.swimmingAbility}`)}</span></div>`);
                  if (iscrizione.tetanusStatus) w.document.write(`<div class="row"><span class="label">${t("printLabels.tetanus")}</span><span>${t(`tetanusValues.${iscrizione.tetanusStatus}`)}</span></div>`);
                  w.document.write(`<h2>${t("printSections.logistics")}</h2>`);
                  if (iscrizione.dietaryNeeds && iscrizione.dietaryNeeds !== "none") w.document.write(`<div class="row"><span class="label">${t("printLabels.diet")}</span><span>${t(`dietValues.${iscrizione.dietaryNeeds}`)}</span></div>`);
                  if (iscrizione.tshirtSize) w.document.write(`<div class="row"><span class="label">${t("printLabels.tshirt")}</span><span>${esc(iscrizione.tshirtSize)}</span></div>`);
                  if (iscrizione.arrivalMode) w.document.write(`<div class="row"><span class="label">${t("printLabels.arrival")}</span><span>${t(`arrivalValues.${iscrizione.arrivalMode}`)} ${iscrizione.arrivalTime || ""}</span></div>`);
                  w.document.write(`<h2>${t("printSections.payments")}</h2>`);
                  w.document.write(`<div class="row"><span class="label">${t("printLabels.quota")}</span><span>${iscrizione.feePaid ? yesLabel : noLabel}${iscrizione.feePaidDate ? ` (${new Date(iscrizione.feePaidDate).toLocaleDateString(dateLocale)})` : ""}</span></div>`);
                  w.document.write(`<div class="row"><span class="label">${t("printLabels.balance")}</span><span>${iscrizione.balancePaid ? yesLabel : noLabel}${iscrizione.balancePaidDate ? ` (${new Date(iscrizione.balancePaidDate).toLocaleDateString(dateLocale)})` : ""}</span></div>`);
                  w.document.write(`<h2>${t("printSections.consents")}</h2>`);
                  w.document.write(`<div class="row"><span class="label">${t("printLabels.privacy")}</span><span>${iscrizione.privacyConsent ? yesLabel : noLabel}</span></div>`);
                  w.document.write(`<div class="row"><span class="label">${t("printLabels.images")}</span><span class="${!iscrizione.imageDataConsent ? "red" : ""}">${iscrizione.imageDataConsent ? yesLabel : noLabel}</span></div>`);
                  w.document.write(`<p style="margin-top:32px;font-size:11px;color:#707070">${t("printFooter", { date: new Date().toLocaleString(dateLocale) })}</p>`);
                  w.document.write(`</body></html>`);
                  w.document.close();
                  w.focus();
                  setTimeout(() => w.print(), 250);
                }}
                className="text-ink hover:text-wwf-green p-1"
                aria-label={t("printAria")}
                title={t("printTitle")}
              >
                <Printer size={18} />
              </button>
              <button onClick={close} className="text-ink-grey hover:text-ink shrink-0">
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Payment status banner */}
          <div className="flex gap-2 mb-4">
            <span className={`tag ${iscrizione.feePaid ? "tag-green" : "tag-red"}`}>
              {t("quota")}: {iscrizione.feePaid ? `✓ ${t("quotaPaid")}` : `✗ ${t("quotaNotPaid")}`}
              {iscrizione.feePaidDate && ` (${new Date(iscrizione.feePaidDate).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" })})`}
            </span>
            <span className={`tag ${iscrizione.balancePaid ? "tag-green" : "tag-red"}`}>
              {tIsc("balance")}: {iscrizione.balancePaid ? `✓ ${t("balancePaid")}` : `✗ ${t("balanceNotPaid")}`}
              {iscrizione.balancePaidDate && ` (${new Date(iscrizione.balancePaidDate).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" })})`}
            </span>
          </div>

          {/* Image consent warning */}
          {!iscrizione.imageDataConsent && (
            <div className="flex items-center gap-2 p-3 bg-wwf-red/10 border-l-4 border-wwf-red">
              <span className="text-wwf-red font-bold text-sm">⚠ {tIsc("noImageConsent")}</span>
              <span className="text-wwf-red text-xs">— {tIsc("noPhotoWarning")}</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="p-6 pt-4 overflow-y-auto">
          <div>
            {/* Contatti */}
            <Section title={t("contacts")}>
              <Row label={tIsc("email")} value={iscrizione.email} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={tIsc("phone")} value={iscrizione.phone} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("birthDate")} value={birthFormatted} yesLabel={yesLabel} noLabel={noLabel} />
            </Section>

            {/* Genitore (se minore) */}
            {iscrizione.isMinor && (
              <Section title={t("guardian")}>
              <Row label={t("guardianName")} value={iscrizione.guardianName} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("guardianEmail")} value={iscrizione.guardianEmail} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("guardianPhone")} value={iscrizione.guardianPhone} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("guardianConsent")} value={iscrizione.guardianConsent ? t("signed") : t("missing")} warn={!iscrizione.guardianConsent} yesLabel={yesLabel} noLabel={noLabel} />
              </Section>
            )}

            {/* Salute */}
            <Section title={t("health")}>
              <Row label={t("allergies")} value={iscrizione.allergies} warn={!!iscrizione.allergies} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("medications")} value={iscrizione.medications} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("swimming")} value={iscrizione.swimmingAbility ? t(`swimValues.${iscrizione.swimmingAbility}`) : null} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("tetanus")} value={iscrizione.tetanusStatus ? t(`tetanusValues.${iscrizione.tetanusStatus}`) : null} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("fitness")} value={iscrizione.fitnessSelf} yesLabel={yesLabel} noLabel={noLabel} />
            </Section>

            {/* Dieta */}
            <Section title={t("diet")}>
              <Row label={t("dietaryNeeds")} value={iscrizione.dietaryNeeds && iscrizione.dietaryNeeds !== "none" ? t(`dietValues.${iscrizione.dietaryNeeds}`) : t("none")} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("dietaryNotes")} value={iscrizione.dietaryNotes} yesLabel={yesLabel} noLabel={noLabel} />
            </Section>

            {/* Logistica */}
            <Section title={t("logistics")}>
              <Row label={t("arrivalMode")} value={iscrizione.arrivalMode ? t(`arrivalValues.${iscrizione.arrivalMode}`) : null} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("arrivalTime")} value={iscrizione.arrivalTime} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("departureTime")} value={iscrizione.departureTime} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("tshirtSize")} value={iscrizione.tshirtSize} yesLabel={yesLabel} noLabel={noLabel} />
              {isMultiTurn && (
                <Row
                  label={t("extraTurnsField")}
                  value={t("extraTurnsValue", { list: iscrizione.extraTurnoNumbers.map((n) => t("camp", { number: n })).join(", ") })}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                />
              )}
            </Section>

            {/* Consensi */}
            <Section title={t("consents")}>
              <Row label={t("privacy")} value={iscrizione.privacyConsent} warn={!iscrizione.privacyConsent} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("marketing")} value={iscrizione.marketingConsent} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("images")} value={iscrizione.imageDataConsent} warn={!iscrizione.imageDataConsent} yesLabel={yesLabel} noLabel={noLabel} />
            </Section>

            {/* Note admin */}
            <Section title={t("adminNotes")}>
              <Row label={t("notes")} value={iscrizione.notes} yesLabel={yesLabel} noLabel={noLabel} />
              <Row label={t("registeredOn")} value={new Date(iscrizione.createdAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" })} yesLabel={yesLabel} noLabel={noLabel} />
            </Section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}