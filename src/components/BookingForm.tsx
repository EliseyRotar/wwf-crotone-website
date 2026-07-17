"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Check, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";

export type TurnoOption = {
  id: string;
  number: number;
  start: Date;
  end: Date;
  capacity: number;
  booked: number;
  isPast: boolean;
};

const CAMP_START = new Date("2026-06-21");

function calcAge(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear();
  const hadBday =
    ref.getMonth() > birth.getMonth() ||
    (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hadBday) age--;
  return age;
}

export default function BookingForm({ turni }: { turni: TurnoOption[] }) {
  const t = useTranslations("Dates");
  const tC = useTranslations("Common");
  const loc = useLocale();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    email: "",
    phone: "",
    isMinor: false, // auto-calculated, not user-selected
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    guardianConsent: false,
    turnoIds: [] as string[],
    allergies: "",
    medications: "",
    swimmingAbility: "",
    tetanusStatus: "",
    fitnessSelf: "",
    dietaryNeeds: "none",
    dietaryNotes: "",
    tshirtSize: "",
    arrivalMode: "",
    arrivalTime: "",
    departureTime: "",
    privacyConsent: false,
    marketingConsent: false,
    imageDataConsent: true,
    website: ""
  });

  const steps = [
    { key: "stepPersonal", n: 1 },
    { key: "stepTurn", n: 2 },
    { key: "stepHealth", n: 3 },
    { key: "stepConsent", n: 4 },
    { key: "stepConfirm", n: 5 }
  ];

  const set = (k: keyof typeof data, v: string | boolean | string[]) =>
    setData((d) => ({ ...d, [k]: v }));

  // Auto-detect isMinor from birthDate
  const computedIsMinor = (() => {
    if (!data.birthDate) return false;
    const birth = new Date(data.birthDate);
    if (isNaN(birth.getTime())) return false;
    return calcAge(birth, CAMP_START) < 18;
  })();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const selectedTurni = turni.filter((t_) => data.turnoIds.includes(t_.id));
  const COST_PER_TURN = 430;
  const totalCost = selectedTurni.length * COST_PER_TURN;

  const toggleTurno = (id: string) => {
    setData((d) => {
      const exists = d.turnoIds.includes(id);
      if (exists) return { ...d, turnoIds: d.turnoIds.filter((x) => x !== id) };
      return { ...d, turnoIds: [...d.turnoIds, id] };
    });
  };

  // Turn status — matches the dates page logic exactly
  const turnStatus = (t_: TurnoOption): "available" | "few" | "full" | "past" => {
    if (t_.isPast) return "past";
    const free = t_.capacity - t_.booked;
    if (free <= 0) return "full";
    if (free <= 4) return "few";
    return "available";
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!data.firstName || !data.lastName || !data.birthDate || !data.email || !data.phone)
        return t("required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return t("invalidEmail");
      // Phone validation: digits and + only, minimum 8
      const cleanPhone = data.phone.replace(/[\s\-()]/g, "");
      if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
        return loc === "it" ? "Numero di telefono non valido (minimo 8 cifre)" : "Invalid phone number (min 8 digits)";
      }
    }
    if (s === 1 && data.turnoIds.length === 0) return t("required");
    if (s === 1 && selectedTurni.some((t_) => t_.isPast))
      return loc === "it" ? "Un turno selezionato è concluso" : "A selected turn has ended";
    if (s === 1 && selectedTurni.some((t_) => t_.booked >= t_.capacity))
      return t("turnFull");
    if (s === 2) {
      if (!data.swimmingAbility) return t("required");
      if (!data.tetanusStatus) return t("required");
      if (!data.tshirtSize) return t("required");
    }
    if (s === 3) {
      // Guardian fields required only if auto-detected as minor
      if (computedIsMinor && (!data.guardianName || !data.guardianPhone || !data.guardianConsent))
        return t("required");
      if (!data.privacyConsent) return t("required");
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    // Sync isMinor before moving on
    if (step === 0) {
      set("isMinor", computedIsMinor);
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    const err = validateStep(3);
    if (err) { setError(err); setStep(3); return; }
    setSubmitting(true);
    setError(null);
    try {
      // Send the auto-computed isMinor, not the user's
      const payload = { ...data, isMinor: computedIsMinor, locale: loc };
      const res = await fetch("/api/iscrizione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        setDone(true);
      } else if (json.error === "turn-full") {
        setError(t("turnFull")); setStep(1);
      } else if (json.error === "turn-past") {
        setError(t("turnPast")); setStep(1);
      } else if (json.error === "duplicate") {
        setError(t("duplicate")); setStep(1);
      } else if (json.error === "guardian-required") {
        setError(t("required")); setStep(3);
      } else if (json.error === "minor-mismatch") {
        setError(loc === "it" ? "La data di nascita non corrisponde allo stato minorenne/maggiorenne." : "Birth date doesn't match minor/adult status.");
        setStep(0);
      } else if (json.error === "birth-future") {
        setError(loc === "it" ? "La data di nascita non può essere nel futuro." : "Birth date cannot be in the future.");
        setStep(0);
      } else if (json.error === "turn-invalid") {
        setError(loc === "it" ? "Uno dei turni selezionati non è valido." : "One of the selected turns is invalid.");
        setStep(1);
      } else if (json.error === "rate-limited") {
        setError(t("rateLimited"));
      } else {
        setError(t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card section-sand">
        <div className="card-body items-center text-center">
          <Check size={40} className="text-wwf-green mb-3" />
          <p className="text-lg text-ink-2">{t("success")}</p>
        </div>
      </div>
    );
  }

  const isPublicTransport = ["train", "bus", "plane_crotone", "plane_lamezia"].includes(data.arrivalMode);

  return (
    <div className="card max-w-3xl">
      <div className="card-body">
        {/* Progress */}
        <ol className="flex items-center gap-1 mb-6 text-xs uppercase tracking-cta overflow-x-auto" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1 shrink-0" aria-current={step === i ? "step" : undefined}>
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 ${
                i < step ? "bg-wwf-green border-wwf-green text-white"
                : i === step ? "border-wwf-green text-wwf-green"
                : "border-ink-grey-light text-ink-grey"}`}>
                {i < step ? <Check size={14} /> : s.n}
              </span>
              <span className={i === step ? "text-wwf-green font-bold" : "text-ink-grey hidden sm:inline"}>
                {t(s.key as never)}
              </span>
              {i < steps.length - 1 && <span className="text-ink-grey-light mx-1">—</span>}
            </li>
          ))}
        </ol>

        {/* Step 0: Personal */}
        {step === 0 && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="field">
              <label htmlFor="fn">{t("firstName")} *</label>
              <input id="fn" value={data.firstName} onChange={(e) => set("firstName", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ln">{t("lastName")} *</label>
              <input id="ln" value={data.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="bd">{t("birthDate")} *</label>
              <input id="bd" type="date" value={data.birthDate} onChange={(e) => set("birthDate", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="em">{t("email")} *</label>
              <input id="em" type="email" inputMode="email" value={data.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ph">{t("phone")} *</label>
              <input id="ph" type="tel" inputMode="numeric" pattern="^\+?[\d\s\-\(\)]{8,20}$" value={data.phone} onChange={(e) => set("phone", e.target.value)} required placeholder={loc === "it" ? "es. +39 333 1234567" : "e.g. +39 333 1234567"} />
            </div>
            {data.birthDate && (
              <div className="field sm:col-span-2">
                <p className="text-sm p-3 rounded-sm" style={{
                  background: computedIsMinor ? "rgba(235,156,75,0.15)" : "rgba(0,121,50,0.10)",
                  borderLeft: `4px solid ${computedIsMinor ? "#eb9c4b" : "#007932"}`
                }}>
                  {computedIsMinor
                    ? (loc === "it"
                      ? "Risulti minorenne al 21 giugno 2026. È richiesto il consenso di un genitore/tutore nel passo 4."
                      : "You are a minor as of June 21, 2026. Parental/guardian consent is required in step 4.")
                    : (loc === "it" ? "Risulti maggiorenne." : "You are an adult.")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Multi-turn selection */}
        {step === 1 && (
          <div>
            <p className="text-sm text-ink-2 mb-2">{t("selectTurnHint")}</p>
            <p className="text-sm text-wwf-green font-bold mb-3">{t("multiTurnInfo")}</p>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {turni.map((t_) => {
                const status = turnStatus(t_);
                const disabled = status === "full" || status === "past";
                const selected = data.turnoIds.includes(t_.id);
                return (
                  <button
                    type="button"
                    key={t_.id}
                    disabled={disabled}
                    onClick={() => toggleTurno(t_.id)}
                    className={`text-left p-3 border-2 transition-colors ${
                      selected ? "border-wwf-green bg-wwf-green-pale/40"
                      : disabled ? "border-ink-grey-light opacity-50 cursor-not-allowed"
                      : "border-ink-grey-light hover:border-wwf-green"}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-bold">{tC("field")} {t_.number}</span>
                      {selected && <Check size={16} className="text-wwf-green" />}
                    </span>
                    <span className="block text-sm">{fmtDate(t_.start)} – {fmtDate(t_.end)}</span>
                    <span className={`block text-xs mt-1 ${
                      status === "full" || status === "past" ? "text-wwf-red" : "text-wwf-green"}`}>
                      {status === "past" ? (loc === "it" ? "Concluso" : "Ended")
                       : status === "full" ? t("turnFull")
                       : status === "few" ? tC("few")
                       : tC("available")}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedTurni.length > 0 && (
              <div className="mt-4 p-4 bg-wwf-green-pale/30 border-2 border-wwf-green">
                <p className="font-bold text-ink">
                  {t("totalCost")}: €{totalCost}
                  <span className="text-sm font-normal text-ink-grey ml-2">
                    ({selectedTurni.length} {t("weeks")})
                  </span>
                </p>
                <ul className="text-sm text-ink-2 mt-2">
                  {selectedTurni.map((t_) => (
                    <li key={t_.id}>{tC("field")} {t_.number}: {fmtDate(t_.start)} – {fmtDate(t_.end)} — €{COST_PER_TURN}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Health & diet */}
        {step === 2 && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="field">
              <label htmlFor="swim">{t("swimmingAbility")} *</label>
              <select id="swim" value={data.swimmingAbility} onChange={(e) => set("swimmingAbility", e.target.value)}>
                <option value="">—</option>
                <option value="none">{t("swimNone")}</option>
                <option value="basic">{t("swimBasic")}</option>
                <option value="confident">{t("swimConfident")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tet">{t("tetanusStatus")} *</label>
              <select id="tet" value={data.tetanusStatus} onChange={(e) => set("tetanusStatus", e.target.value)}>
                <option value="">—</option>
                <option value="unknown">{t("tetanusUnknown")}</option>
                <option value="vaccinated">{t("tetanusVaccinated")}</option>
                <option value="not_vaccinated">{t("tetanusNot")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="all">{t("allergies")}</label>
              <input id="all" value={data.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="med">{t("medications")}</label>
              <input id="med" value={data.medications} onChange={(e) => set("medications", e.target.value)} />
            </div>
            <div className="field sm:col-span-2">
              <label htmlFor="fit">{t("fitnessSelf")}</label>
              <input id="fit" value={data.fitnessSelf} onChange={(e) => set("fitnessSelf", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="diet">{t("dietaryNeeds")} *</label>
              <select id="diet" value={data.dietaryNeeds} onChange={(e) => set("dietaryNeeds", e.target.value)}>
                <option value="none">{t("dietNone")}</option>
                <option value="vegetarian">{t("dietVegetarian")}</option>
                <option value="vegan">{t("dietVegan")}</option>
                <option value="celiac">{t("dietCeliac")}</option>
                <option value="other">{t("dietOther")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dietn">{t("dietaryNotes")}</label>
              <input id="dietn" value={data.dietaryNotes} onChange={(e) => set("dietaryNotes", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ts">{t("tshirtSize")} *</label>
              <select id="ts" value={data.tshirtSize} onChange={(e) => set("tshirtSize", e.target.value)}>
                <option value="">—</option>
                {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Logistics + Consent */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Logistics subsection */}
            <div>
              <h3 className="text-sm uppercase tracking-cta text-wwf-green mb-3" style={{ borderBottom: "2px solid #007932", paddingBottom: "4px" }}>
                {loc === "it" ? "Logistica" : "Logistics"}
              </h3>
              <div className="grid sm:grid-cols-2 gap-x-4">
                <div className="field">
                  <label htmlFor="arr">{t("arrivalMode")}</label>
                  <select id="arr" value={data.arrivalMode} onChange={(e) => set("arrivalMode", e.target.value)}>
                    <option value="">—</option>
                    <option value="own_car">{t("arrivalOwn")}</option>
                    <option value="train">{t("arrivalTrain")}</option>
                    <option value="bus">{t("arrivalBus")}</option>
                    <option value="plane_crotone">{t("arrivalPlaneCrotone")}</option>
                    <option value="plane_lamezia">{t("arrivalPlaneLamezia")}</option>
                    <option value="need_pickup">{t("arrivalPickup")}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ts2">{t("tshirtSize")}</label>
                  <span className="text-sm text-ink-2">{data.tshirtSize || "—"}</span>
                </div>
                <div className="field">
                  <label htmlFor="atime">{t("arrivalTime")}</label>
                  <input id="atime" type="time" value={data.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="dtime">{t("departureTime")}</label>
                  <input id="dtime" type="time" value={data.departureTime} onChange={(e) => set("departureTime", e.target.value)} />
                </div>
              </div>
              {isPublicTransport && (
                <div className="sm:col-span-2 flex items-start gap-2 p-3 mt-2" style={{ background: "rgba(245,201,86,0.20)", borderLeft: "4px solid #f5c956" }}>
                  <AlertTriangle size={20} className="text-ink shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-2">{t("arrivalTimeWarning")}</p>
                </div>
              )}
            </div>

            {/* Guardian consent (if minor) */}
            {computedIsMinor && (
              <div className="section-sand -mx-4 px-4 py-4 border-l-4 border-wwf-orange">
                <p className="text-sm font-bold mb-3">{t("minorNote")}</p>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div className="field">
                    <label htmlFor="gn">{t("guardianName")} *</label>
                    <input id="gn" value={data.guardianName} onChange={(e) => set("guardianName", e.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="ge">{t("guardianEmail")}</label>
                    <input id="ge" type="email" value={data.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="gp">{t("guardianPhone")} *</label>
                    <input id="gp" type="tel" inputMode="numeric" value={data.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} required />
                  </div>
                </div>
                <label className="flex items-start gap-2 text-sm mt-2">
                  <input type="checkbox" checked={data.guardianConsent} onChange={(e) => set("guardianConsent", e.target.checked)} required className="mt-0.5" />
                  <span>{t("guardianConsent")}</span>
                </label>
              </div>
            )}

            {/* Consents */}
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={data.privacyConsent} onChange={(e) => set("privacyConsent", e.target.checked)} required className="mt-0.5" />
                <span>{t("privacyConsent")} *</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={data.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} className="mt-0.5" />
                <span>{t("marketingConsent")}</span>
              </label>
              <div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={data.imageDataConsent} onChange={(e) => set("imageDataConsent", e.target.checked)} className="mt-0.5" />
                  <span>{t("imageDataConsent")}</span>
                </label>
                {!data.imageDataConsent && (
                  <div className="flex items-start gap-2 ml-7 mt-2 p-2" style={{ background: "rgba(237,43,0,0.10)", borderLeft: "4px solid #ed2b00" }}>
                    <AlertTriangle size={16} className="text-wwf-red shrink-0 mt-0.5" />
                    <p className="text-xs text-wwf-red">{t("imageDataWarning")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-3 text-sm">
            <h3 className="text-lg mb-2">{t("stepConfirm")}</h3>
            <p><strong>{t("firstName")}:</strong> {data.firstName} {data.lastName}</p>
            <p><strong>{t("email")}:</strong> {data.email} · <strong>{t("phone")}:</strong> {data.phone}</p>
            <p><strong>{t("birthDate")}:</strong> {data.birthDate}{computedIsMinor ? ` (${loc === "it" ? "minorenne" : "minor"})` : ""}</p>
            <div>
              <strong>{t("selectTurn")}:</strong>
              <ul className="ml-4 mt-1">
                {selectedTurni.map((t_) => (
                  <li key={t_.id}>{tC("field")} {t_.number} — {fmtDate(t_.start)} → {fmtDate(t_.end)}</li>
                ))}
              </ul>
            </div>
            <p><strong>{t("totalCost")}:</strong> €{totalCost} ({selectedTurni.length} {t("weeks")})</p>
            {data.swimmingAbility && <p><strong>{t("swimmingAbility")}:</strong> {t(("swim" + data.swimmingAbility.charAt(0).toUpperCase() + data.swimmingAbility.slice(1)) as never)}</p>}
            {data.tetanusStatus && <p><strong>{t("tetanusStatus")}:</strong> {t(("tetanus" + (data.tetanusStatus === "not_vaccinated" ? "Not" : data.tetanusStatus === "vaccinated" ? "Vaccinated" : "Unknown")) as never)}</p>}
            {data.allergies && <p><strong>{t("allergies")}:</strong> {data.allergies}</p>}
            {data.dietaryNeeds && data.dietaryNeeds !== "none" && (
              <p><strong>{t("dietaryNeeds")}:</strong> {t(("diet" + data.dietaryNeeds.charAt(0).toUpperCase() + data.dietaryNeeds.slice(1)) as never)}</p>
            )}
            {data.tshirtSize && <p><strong>{t("tshirtSize")}:</strong> {data.tshirtSize}</p>}
            {data.arrivalMode && (
              <p><strong>{t("arrivalMode")}:</strong> {
                data.arrivalMode === "own_car" ? t("arrivalOwn") :
                data.arrivalMode === "train" ? t("arrivalTrain") :
                data.arrivalMode === "bus" ? t("arrivalBus") :
                data.arrivalMode === "plane_crotone" ? t("arrivalPlaneCrotone") :
                data.arrivalMode === "plane_lamezia" ? t("arrivalPlaneLamezia") :
                t("arrivalPickup")
              }
                {data.arrivalTime && ` · ${t("arrivalTime")}: ${data.arrivalTime}`}
                {data.departureTime && ` · ${t("departureTime")}: ${data.departureTime}`}
              </p>
            )}
            {!data.imageDataConsent && (
              <p className="text-wwf-red"><AlertTriangle size={14} className="inline mr-1" />{t("imageDataWarning")}</p>
            )}
            <p className="text-xs text-ink-grey mt-4">
              {loc === "it"
                ? "Premendo invia confermi di accettare le condizioni e l'informativa privacy. Riceverai una email di conferma."
                : "By submitting you confirm you accept the conditions and the privacy policy. You will receive a confirmation email."}
            </p>
          </div>
        )}

        {/* Honeypot */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => set("website", e.target.value)} className="hidden" aria-hidden="true" />

        {error && <p className="field-error mt-3" role="alert" aria-live="polite">{error}</p>}

        {/* Nav buttons */}
        <div className="flex justify-between mt-6">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-outline"><ArrowLeft size={18} /> {t("back")}</button>
          ) : <span />}
          {step < steps.length - 1 ? (
            <button type="button" onClick={next} className="btn btn-green">{t("next")} <ArrowRight size={18} /></button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} className="btn btn-primary">{submitting ? "…" : t("submit")}</button>
          )}
        </div>
      </div>
    </div>
  );
}