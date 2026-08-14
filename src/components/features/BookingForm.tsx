"use client";

import { useReducer, useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Check, ArrowRight, ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { getTurnStatus, calcAge } from "@/lib/turns";

export type TurnoOption = {
  id: string;
  number: number;
  start: Date;
  end: Date;
  capacity: number;
  booked: number;
  isPast: boolean;
};

type FormState = {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  isMinor: boolean;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianConsent: boolean;
  turnoIds: string[];
  allergies: string;
  medications: string;
  swimmingAbility: string;
  tetanusStatus: string;
  fitnessSelf: string;
  dietaryNeeds: string;
  dietaryNotes: string;
  tshirtSize: string;
  arrivalMode: string;
  arrivalFrom: string;
  flightNumber: string;
  trainNumber: string;
  busCompany: string;
  arrivalNotes: string;
  arrivalTime: string;
  departureTime: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  imageDataConsent: boolean;
  website: string;
};

type FormAction =
  | { type: "set"; key: keyof FormState; value: string | boolean | string[] }
  | { type: "toggleTurno"; id: string }
  | { type: "reset" }
  | { type: "hydrate"; value: Partial<FormState> };

const DRAFT_KEY = "wwf-crotone-booking-draft";

const SWIM_LABEL_KEYS = {
  none: "swimNone",
  basic: "swimBasic",
  confident: "swimConfident"
} as const;

const TETANUS_LABEL_KEYS = {
  unknown: "tetanusUnknown",
  vaccinated: "tetanusVaccinated",
  not_vaccinated: "tetanusNot"
} as const;

const DIET_LABEL_KEYS = {
  none: "dietNone",
  vegetarian: "dietVegetarian",
  vegan: "dietVegan",
  celiac: "dietCeliac",
  other: "dietOther"
} as const;

const INITIAL_STATE: FormState = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  phone: "",
  isMinor: false,
  guardianName: "",
  guardianEmail: "",
  guardianPhone: "",
  guardianConsent: false,
  turnoIds: [],
  allergies: "",
  medications: "",
  swimmingAbility: "",
  tetanusStatus: "",
  fitnessSelf: "",
  dietaryNeeds: "none",
  dietaryNotes: "",
  tshirtSize: "",
  arrivalMode: "",
  arrivalFrom: "",
  flightNumber: "",
  trainNumber: "",
  busCompany: "",
  arrivalNotes: "",
  arrivalTime: "",
  departureTime: "",
  privacyConsent: false,
  marketingConsent: false,
  imageDataConsent: true,
  website: ""
};

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "toggleTurno": {
      const exists = state.turnoIds.includes(action.id);
      return {
        ...state,
        turnoIds: exists
          ? state.turnoIds.filter((x) => x !== action.id)
          : [...state.turnoIds, action.id]
      };
    }
    case "hydrate":
      return { ...state, ...action.value };
    case "reset":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export default function BookingForm({ turni }: { turni: TurnoOption[] }) {
  const t = useTranslations("Dates");
  const tC = useTranslations("Common");
  const loc = useLocale();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const [errorFieldId, setErrorFieldId] = useState<string | null>(null);

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, (init) => {
    if (typeof window === "undefined") return init;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return init;
      const parsed = JSON.parse(raw) as Partial<FormState>;
      return { ...init, ...parsed };
    } catch {
      return init;
    }
  });

  // Persist a draft to localStorage on every change
  useEffect(() => {
    if (done) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {}
  }, [state, done]);

  const set = (key: keyof FormState, value: string | boolean | string[]) =>
    dispatch({ type: "set", key, value });

  const toggleTurno = (id: string) => dispatch({ type: "toggleTurno", id });

  const saveDraft = () => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    } catch {
      setError(t("draftSaveError"));
    }
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
    dispatch({ type: "reset" });
    setStep(0);
  };

  const steps = [
    { key: "stepPersonal", n: 1 },
    { key: "stepTurn", n: 2 },
    { key: "stepHealth", n: 3 },
    { key: "stepConsent", n: 4 },
    { key: "stepConfirm", n: 5 }
  ] as const;

  const computedIsMinor = (() => {
    if (!state.birthDate) return false;
    const birth = new Date(state.birthDate);
    if (isNaN(birth.getTime())) return false;
    return calcAge(birth, new Date()) < 18;
  })();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  const selectedTurni = turni.filter((t_) => state.turnoIds.includes(t_.id));
  const COST_PER_TURN = 430;
  // Progressive discount: -15% for second week, -25% from third onwards
  function calcTotalCost(weeks: number, costPerWeek: number): { total: number; original: number; savings: number } {
    const original = weeks * costPerWeek;
    if (weeks <= 1) return { total: original, original, savings: 0 };
    let total = costPerWeek;
    if (weeks >= 2) total += costPerWeek * 0.85;
    for (let i = 3; i <= weeks; i++) total += costPerWeek * 0.75;
    return { total: Math.round(total), original, savings: original - Math.round(total) };
  }
  const costBreakdown = calcTotalCost(selectedTurni.length, COST_PER_TURN);

  const validateStep = (s: number): { message: string; fieldId?: string } | null => {
    if (s === 0) {
      if (!state.firstName) return { message: t("required"), fieldId: "fn" };
      if (!state.lastName) return { message: t("required"), fieldId: "ln" };
      if (!state.birthDate) return { message: t("required"), fieldId: "bd" };
      if (!state.email) return { message: t("required"), fieldId: "em" };
      if (!state.phone) return { message: t("required"), fieldId: "ph" };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) return { message: t("invalidEmail"), fieldId: "em" };
      const cleanPhone = state.phone.replace(/[\s\-()]/g, "");
      if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
        return {
          message: t("invalidPhone"),
          fieldId: "ph"
        };
      }
    }
    if (s === 1 && state.turnoIds.length === 0) return { message: t("required") };
    if (s === 1 && selectedTurni.some((t_) => t_.isPast))
      return { message: t("campoOneEnded") };
    if (s === 1 && selectedTurni.some((t_) => t_.booked >= t_.capacity))
      return { message: t("campoFull") };
    if (s === 2) {
      if (!state.swimmingAbility) return { message: t("required"), fieldId: "swim" };
      if (!state.tetanusStatus) return { message: t("required"), fieldId: "tet" };
      if (!state.tshirtSize) return { message: t("required"), fieldId: "ts" };
    }
    if (s === 3) {
      // Arrival mode is REQUIRED for logistics planning
      if (!state.arrivalMode) return { message: t("arrivalModeRequired"), fieldId: "arr" };
      // Public transport / flight / ferry / pickup — strongly suggest flight/train/company
      const needsTransportDetails =
        state.arrivalMode === "train" ||
        state.arrivalMode === "bus" ||
        state.arrivalMode === "plane_crotone" ||
        state.arrivalMode === "plane_lamezia" ||
        state.arrivalMode === "ferry" ||
        state.arrivalMode === "need_pickup";
      if (needsTransportDetails && !state.arrivalFrom) {
        return { message: t("required"), fieldId: "arrfrom" };
      }
      if (computedIsMinor && !state.guardianName) return { message: t("required"), fieldId: "gn" };
      if (computedIsMinor && !state.guardianPhone) return { message: t("required"), fieldId: "gp" };
      if (computedIsMinor && !state.guardianConsent)
        return { message: t("required") };
      if (!state.privacyConsent) return { message: t("required") };
    }
    return null;
  };

  const joinWaitlist = (turnoId: string) => {
    if (typeof window === "undefined") return;
    const number = turni.find((x) => x.id === turnoId)?.number ?? "";
    const subject = encodeURIComponent(t("waitlistMailSubject", { number }));
    const body = encodeURIComponent(t("waitlistMailBody", { number }));
    window.location.href = `mailto:wwfcrotone26@gmail.com?subject=${subject}&body=${body}`;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { setError(err.message); setErrorFieldId(err.fieldId ?? null); return; }
    setError(null);
    setErrorFieldId(null);
    if (step === 0) {
      set("isMinor", computedIsMinor);
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => {
    setError(null);
    setErrorFieldId(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    const err = validateStep(3);
    if (err) { setError(err.message); setErrorFieldId(err.fieldId ?? null); setStep(3); return; }
    setSubmitting(true);
    setError(null);
    setErrorFieldId(null);
    try {
      const payload = { ...state, isMinor: computedIsMinor, locale: loc };
      const res = await fetch("/api/iscrizione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        setDone(true);
        try { window.localStorage.removeItem(DRAFT_KEY); } catch {}
      } else if (json.error === "turn-full") {
        setError(t("campoFull")); setStep(1);
      } else if (json.error === "turn-past") {
        setError(t("campoPast")); setStep(1);
      } else if (json.error === "duplicate") {
        setError(t("duplicate")); setStep(1);
      } else if (json.error === "guardian-required") {
        setError(t("required")); setStep(3);
      } else if (json.error === "minor-mismatch") {
        setError(t("birthMinorMismatch"));
        setStep(0);
      } else if (json.error === "birth-future") {
        setError(t("birthFuture"));
        setStep(0);
      } else if (json.error === "turn-invalid") {
        setError(t("campoInvalid"));
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

  const isPublicTransport = ["train", "bus", "plane_crotone", "plane_lamezia", "ferry"].includes(state.arrivalMode);

  return (
    <div className="card max-w-3xl">
      <div className="card-body">
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
                {t(s.key)}
              </span>
              {i < steps.length - 1 && <span className="text-ink-grey-light mx-1">—</span>}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="field">
              <label htmlFor="fn">{t("firstName")} *</label>
              <input id="fn" value={state.firstName} onChange={(e) => set("firstName", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ln">{t("lastName")} *</label>
              <input id="ln" value={state.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="bd">{t("birthDate")} *</label>
              <input
                id="bd"
                type="date"
                value={state.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
                min="1940-01-01"
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="em">{t("email")} *</label>
              <input id="em" type="email" inputMode="email" value={state.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ph">{t("phone")} *</label>
              <input id="ph" type="tel" inputMode="numeric" pattern="^\+?[\d\s\-\(\)]{8,20}$" value={state.phone} onChange={(e) => set("phone", e.target.value)} required placeholder={t("phonePlaceholder")} />
            </div>
            {state.birthDate && (
              <div className="field sm:col-span-2">
                <p className={`text-sm p-3 rounded-sm border-l-4 ${computedIsMinor ? "bg-wwf-orange/15 border-wwf-orange" : "bg-wwf-green/10 border-wwf-green"}`}>
                  {computedIsMinor ? t("minorNotice") : t("adultNotice")}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-sm text-ink-2 mb-2">{t("selectTurnHint")}</p>
            <p className="text-sm text-wwf-green font-bold mb-3">{t("multiTurnInfo")}</p>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {turni.map((t_) => {
                const status = getTurnStatus(t_.booked, t_.capacity, t_.end);
                const isFull = status === "full";
                const isPast = status === "past";
                const selected = state.turnoIds.includes(t_.id);
                return (
                  <div key={t_.id} className="space-y-1">
                    <button
                      type="button"
                      disabled={isPast}
                      onClick={() => toggleTurno(t_.id)}
                      className={`w-full text-left p-3 border-2 transition-colors ${
                        selected ? "border-wwf-green bg-wwf-green-pale/40"
                        : isPast ? "border-ink-grey-light opacity-50 cursor-not-allowed"
                        : isFull ? "border-ink-grey-light hover:border-wwf-green"
                        : "border-ink-grey-light hover:border-wwf-green"}`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-bold">{tC("field")} {t_.number}</span>
                        {selected && <Check size={16} className="text-wwf-green" />}
                      </span>
                      <span className="block text-sm">{fmtDate(t_.start)} – {fmtDate(t_.end)}</span>
                      <span className={`block text-xs mt-1 ${
                        isFull || isPast ? "text-wwf-red" : "text-wwf-green"}`}>
                        {isPast ? t("campoPastOne")
                         : isFull ? t("campoFull")
                         : status === "few" ? tC("few")
                         : tC("available")}
                      </span>
                    </button>
                    {isFull && !isPast && (
                      <button
                        type="button"
                        onClick={() => joinWaitlist(t_.id)}
                        className="text-xs text-wwf-orange font-semibold hover:underline px-1"
                      >
                        {t("joinWaitlist")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedTurni.length > 0 && (
              <div className="mt-4 p-4 bg-wwf-green-pale/30 border-2 border-wwf-green">
                <p className="font-bold text-ink">
                  {t("totalCost")}: €{costBreakdown.total}
                  <span className="text-sm font-normal text-ink-grey ml-2">
                    ({selectedTurni.length} {t("weeks")})
                  </span>
                </p>
                {costBreakdown.savings > 0 && (
                  <p className="text-sm text-wwf-green-dark font-semibold mt-2">
                    ✓ {loc === "it" ? `Risparmi €${costBreakdown.savings} con lo sconto multi-settimana!` : `You save €${costBreakdown.savings} with the multi-week discount!`}
                    {selectedTurni.length === 2 && ` (${loc === "it" ? "15% sulla seconda" : "15% on the second"})`}
                    {selectedTurni.length >= 3 && ` (${loc === "it" ? "15% sulla seconda + 25% dalla terza" : "15% on 2nd + 25% from 3rd"})`}
                  </p>
                )}
                <ul className="text-sm text-ink-2 mt-2">
                  {selectedTurni.map((t_, i) => {
                    const weekCost = i === 0 ? COST_PER_TURN : i === 1 ? Math.round(COST_PER_TURN * 0.85) : Math.round(COST_PER_TURN * 0.75);
                    return (
                      <li key={t_.id}>
                        {tC("field")} {t_.number}: {fmtDate(t_.start)} – {fmtDate(t_.end)} — €{weekCost}
                        {i > 0 && <span className="text-wwf-green-dark"> (-{i === 1 ? "15%" : "25%"})</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="field">
              <label htmlFor="swim">{t("swimmingAbility")} *</label>
              <select id="swim" value={state.swimmingAbility} onChange={(e) => set("swimmingAbility", e.target.value)}>
                <option value="">—</option>
                <option value="none">{t("swimNone")}</option>
                <option value="basic">{t("swimBasic")}</option>
                <option value="confident">{t("swimConfident")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tet">{t("tetanusStatus")} *</label>
              <select id="tet" value={state.tetanusStatus} onChange={(e) => set("tetanusStatus", e.target.value)}>
                <option value="">—</option>
                <option value="unknown">{t("tetanusUnknown")}</option>
                <option value="vaccinated">{t("tetanusVaccinated")}</option>
                <option value="not_vaccinated">{t("tetanusNot")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="all">{t("allergies")}</label>
              <input id="all" value={state.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="med">{t("medications")}</label>
              <input id="med" value={state.medications} onChange={(e) => set("medications", e.target.value)} />
            </div>
            <div className="field sm:col-span-2">
              <label htmlFor="fit">{t("fitnessSelf")}</label>
              <input id="fit" value={state.fitnessSelf} onChange={(e) => set("fitnessSelf", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="diet">{t("dietaryNeeds")} *</label>
              <select id="diet" value={state.dietaryNeeds} onChange={(e) => set("dietaryNeeds", e.target.value)}>
                <option value="none">{t("dietNone")}</option>
                <option value="vegetarian">{t("dietVegetarian")}</option>
                <option value="vegan">{t("dietVegan")}</option>
                <option value="celiac">{t("dietCeliac")}</option>
                <option value="other">{t("dietOther")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dietn">{t("dietaryNotes")}</label>
              <input id="dietn" value={state.dietaryNotes} onChange={(e) => set("dietaryNotes", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ts">{t("tshirtSize")} *</label>
              <select id="ts" value={state.tshirtSize} onChange={(e) => set("tshirtSize", e.target.value)}>
                <option value="">—</option>
                {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm uppercase tracking-cta text-wwf-green mb-3 border-b-2 border-wwf-green pb-1">
                {t("logisticsTitle")}
              </h3>
              <p className="text-sm text-ink-grey mb-4">{t("arrivalModeHelp")}</p>

              <div className="field mb-4">
                <label htmlFor="arr" className="font-semibold">
                  {t("arrivalMode")} <span className="text-ink-red">*</span>
                </label>
                <select
                  id="arr"
                  value={state.arrivalMode}
                  onChange={(e) => set("arrivalMode", e.target.value)}
                  className={!state.arrivalMode ? "border-ink-red" : ""}
                >
                  <option value="">—</option>
                  <option value="own_car">{t("arrivalOwn")}</option>
                  <option value="train">{t("arrivalTrain")}</option>
                  <option value="bus">{t("arrivalBus")}</option>
                  <option value="plane_crotone">{t("arrivalPlaneCrotone")}</option>
                  <option value="plane_lamezia">{t("arrivalPlaneLamezia")}</option>
                  <option value="ferry">{t("arrivalFerry")}</option>
                  <option value="taxi">{t("arrivalTaxi")}</option>
                  <option value="rental_car">{t("arrivalRentalCar")}</option>
                  <option value="need_pickup">{t("arrivalPickup")}</option>
                  <option value="other">{t("arrivalOther")}</option>
                </select>
              </div>

              {/* Conditional sub-fields based on arrival mode */}
              {state.arrivalMode && state.arrivalMode !== "own_car" && (
                <div className="field mb-4">
                  <label htmlFor="arrfrom" className="font-semibold">
                    {t("arrivalFrom")}
                    {(state.arrivalMode === "train" ||
                      state.arrivalMode === "bus" ||
                      state.arrivalMode === "plane_crotone" ||
                      state.arrivalMode === "plane_lamezia" ||
                      state.arrivalMode === "ferry" ||
                      state.arrivalMode === "need_pickup") && (
                      <span className="text-ink-red"> *</span>
                    )}
                  </label>
                  <input
                    id="arrfrom"
                    value={state.arrivalFrom}
                    onChange={(e) => set("arrivalFrom", e.target.value)}
                    placeholder={t("arrivalFromHelp")}
                  />
                </div>
              )}

              {state.arrivalMode === "plane_crotone" && (
                <div className="field mb-4">
                  <label htmlFor="flight">{t("flightNumber")}</label>
                  <input
                    id="flight"
                    value={state.flightNumber}
                    onChange={(e) => set("flightNumber", e.target.value)}
                    placeholder={t("flightNumberHelp")}
                  />
                </div>
              )}

              {state.arrivalMode === "plane_lamezia" && (
                <div className="field mb-4">
                  <label htmlFor="flight">{t("flightNumber")}</label>
                  <input
                    id="flight"
                    value={state.flightNumber}
                    onChange={(e) => set("flightNumber", e.target.value)}
                    placeholder={t("flightNumberHelp")}
                  />
                </div>
              )}

              {state.arrivalMode === "train" && (
                <div className="field mb-4">
                  <label htmlFor="trainnum">{t("trainNumber")}</label>
                  <input
                    id="trainnum"
                    value={state.trainNumber}
                    onChange={(e) => set("trainNumber", e.target.value)}
                    placeholder={t("trainNumberHelp")}
                  />
                </div>
              )}

              {(state.arrivalMode === "bus" || state.arrivalMode === "ferry") && (
                <div className="field mb-4">
                  <label htmlFor="buscomp">{t("busCompany")}</label>
                  <input
                    id="buscomp"
                    value={state.busCompany}
                    onChange={(e) => set("busCompany", e.target.value)}
                    placeholder={t("busCompanyHelp")}
                  />
                </div>
              )}

              {state.arrivalMode && (
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div className="field">
                    <label htmlFor="atime">{t("arrivalTime")}</label>
                    <input
                      id="atime"
                      type="time"
                      value={state.arrivalTime}
                      onChange={(e) => set("arrivalTime", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="dtime">{t("departureTime")}</label>
                    <input
                      id="dtime"
                      type="time"
                      value={state.departureTime}
                      onChange={(e) => set("departureTime", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="field mt-4">
                <label htmlFor="arrnotes">{t("arrivalNotes")}</label>
                <textarea
                  id="arrnotes"
                  rows={2}
                  value={state.arrivalNotes}
                  onChange={(e) => set("arrivalNotes", e.target.value)}
                  placeholder={t("arrivalNotesHelp")}
                  className="min-h-[60px]"
                />
              </div>

              {isPublicTransport && (
                <div className="flex items-start gap-2 p-3 mt-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <AlertTriangle size={20} className="text-ink shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-2">{t("arrivalTimeWarning")}</p>
                </div>
              )}
            </div>

            {computedIsMinor && (
              <div className="section-sand -mx-4 px-4 py-4 border-l-4 border-wwf-orange">
                <p className="text-sm font-bold mb-3">{t("minorNote")}</p>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div className="field">
                    <label htmlFor="gn">{t("guardianName")} *</label>
                    <input id="gn" value={state.guardianName} onChange={(e) => set("guardianName", e.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="ge">{t("guardianEmail")}</label>
                    <input id="ge" type="email" value={state.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="gp">{t("guardianPhone")} *</label>
                    <input id="gp" type="tel" inputMode="numeric" value={state.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} required />
                  </div>
                </div>
                <label className="flex items-start gap-2 text-sm mt-2">
                  <input type="checkbox" checked={state.guardianConsent} onChange={(e) => set("guardianConsent", e.target.checked)} required className="mt-0.5" />
                  <span>{t("guardianConsent")}</span>
                </label>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={state.privacyConsent} onChange={(e) => set("privacyConsent", e.target.checked)} required className="mt-0.5" />
                <span>{t("privacyConsent")} *</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={state.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} className="mt-0.5" />
                <span>{t("marketingConsent")}</span>
              </label>
              <div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={state.imageDataConsent} onChange={(e) => set("imageDataConsent", e.target.checked)} className="mt-0.5" />
                  <span>{t("imageDataConsent")}</span>
                </label>
                {!state.imageDataConsent && (
                  <div className="flex items-start gap-2 ml-7 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border-l-4 border-wwf-red">
                    <AlertTriangle size={16} className="text-wwf-red shrink-0 mt-0.5" />
                    <p className="text-xs text-wwf-red">{t("imageDataWarning")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <h3 className="text-lg mb-2">{t("stepConfirm")}</h3>
            <p><strong>{t("firstName")}:</strong> {state.firstName} {state.lastName}</p>
            <p><strong>{t("email")}:</strong> {state.email} · <strong>{t("phone")}:</strong> {state.phone}</p>
            <p><strong>{t("birthDate")}:</strong> {state.birthDate}{computedIsMinor ? ` (${t("minorLabel")})` : ""}</p>
            <div>
              <strong>{t("selectTurn")}:</strong>
              <ul className="ml-4 mt-1">
                {selectedTurni.map((t_) => (
                  <li key={t_.id}>{tC("field")} {t_.number} — {fmtDate(t_.start)} → {fmtDate(t_.end)}</li>
                ))}
              </ul>
            </div>
            <p>
              <strong>{t("totalCost")}:</strong> €{costBreakdown.total}
              <span className="text-sm text-ink-grey ml-2">({selectedTurni.length} {t("weeks")})</span>
              {costBreakdown.savings > 0 && (
                <span className="text-sm text-wwf-green-dark font-semibold ml-2">
                  ({loc === "it" ? `risparmi €${costBreakdown.savings}` : `you save €${costBreakdown.savings}`})
                </span>
              )}
            </p>
            {state.swimmingAbility && <p><strong>{t("swimmingAbility")}:</strong> {t(SWIM_LABEL_KEYS[state.swimmingAbility as keyof typeof SWIM_LABEL_KEYS])}</p>}
            {state.tetanusStatus && <p><strong>{t("tetanusStatus")}:</strong> {t(TETANUS_LABEL_KEYS[state.tetanusStatus as keyof typeof TETANUS_LABEL_KEYS])}</p>}
            {state.allergies && <p><strong>{t("allergies")}:</strong> {state.allergies}</p>}
            {state.dietaryNeeds && state.dietaryNeeds !== "none" && (
              <p><strong>{t("dietaryNeeds")}:</strong> {t(DIET_LABEL_KEYS[state.dietaryNeeds as keyof typeof DIET_LABEL_KEYS])}</p>
            )}
            {state.tshirtSize && <p><strong>{t("tshirtSize")}:</strong> {state.tshirtSize}</p>}
            {state.arrivalMode && (
              <div className="space-y-1">
                <p>
                  <strong>{t("arrivalMode")}:</strong>{" "}
                  {state.arrivalMode === "own_car" ? t("arrivalOwn") :
                   state.arrivalMode === "train" ? t("arrivalTrain") :
                   state.arrivalMode === "bus" ? t("arrivalBus") :
                   state.arrivalMode === "plane_crotone" ? t("arrivalPlaneCrotone") :
                   state.arrivalMode === "plane_lamezia" ? t("arrivalPlaneLamezia") :
                   state.arrivalMode === "ferry" ? t("arrivalFerry") :
                   state.arrivalMode === "taxi" ? t("arrivalTaxi") :
                   state.arrivalMode === "rental_car" ? t("arrivalRentalCar") :
                   state.arrivalMode === "need_pickup" ? t("arrivalPickup") :
                   t("arrivalOther")}
                </p>
                {state.arrivalFrom && (
                  <p className="text-sm text-ink-grey pl-4">{t("arrivalFrom")}: {state.arrivalFrom}</p>
                )}
                {state.flightNumber && (
                  <p className="text-sm text-ink-grey pl-4">{t("flightNumber")}: {state.flightNumber}</p>
                )}
                {state.trainNumber && (
                  <p className="text-sm text-ink-grey pl-4">{t("trainNumber")}: {state.trainNumber}</p>
                )}
                {state.busCompany && (
                  <p className="text-sm text-ink-grey pl-4">{t("busCompany")}: {state.busCompany}</p>
                )}
                {state.arrivalTime && (
                  <p className="text-sm text-ink-grey pl-4">{t("arrivalTime")}: {state.arrivalTime}</p>
                )}
                {state.departureTime && (
                  <p className="text-sm text-ink-grey pl-4">{t("departureTime")}: {state.departureTime}</p>
                )}
                {state.arrivalNotes && (
                  <p className="text-sm text-ink-grey pl-4">{t("arrivalNotes")}: {state.arrivalNotes}</p>
                )}
              </div>
            )}
            {!state.imageDataConsent && (
              <p className="text-wwf-red"><AlertTriangle size={14} className="inline mr-1" />{t("imageDataWarning")}</p>
            )}
            <p className="text-xs text-ink-grey mt-4">
              {t("submitConfirm")}
            </p>
          </div>
        )}

        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={state.website} onChange={(e) => set("website", e.target.value)} className="hidden" aria-hidden="true" />

        {error && (
          <div className="field-error mt-3" role="alert" aria-live="polite" tabIndex={-1}>
            {errorFieldId ? (
              <a href={`#${errorFieldId}`} className="underline">{error}</a>
            ) : (
              error
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={saveDraft}
            className="text-xs text-ink-grey hover:text-wwf-green underline-offset-2 hover:underline"
            aria-label={t("saveDraftAria")}
          >
            {t("saveDraft")}
          </button>
          {draftSaved && <span className="text-xs text-wwf-green">✓</span>}
          {step > 0 && (
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs text-ink-grey hover:text-wwf-red underline-offset-2 hover:underline ml-auto"
              aria-label={t("clearForm")}
            >
              {t("clearFormLabel")}
            </button>
          )}
        </div>

        <div className="flex justify-between mt-4">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-outline"><ArrowLeft size={18} /> {t("back")}</button>
          ) : <span />}
          {step < steps.length - 1 ? (
            <button type="button" onClick={next} className="btn btn-green">{t("next")} <ArrowRight size={18} /></button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} className="btn btn-primary" aria-busy={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
