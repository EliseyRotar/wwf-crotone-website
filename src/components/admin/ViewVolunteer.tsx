"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, X } from "lucide-react";

type Iscrizione = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
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
  additionalTurns: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  confirmed: "Confermato",
  paid: "Pagato",
  cancelled: "Annullato",
  waitlist: "Lista d'attesa"
};

const STATUS_COLORS: Record<string, string> = {
  pending: "tag-grey",
  confirmed: "tag-blue",
  paid: "tag-green",
  cancelled: "tag-red",
  waitlist: "tag-orange"
};

const DIET_LABELS: Record<string, string> = {
  none: "Nessuna",
  vegetarian: "Vegetariano",
  vegan: "Vegano",
  celiac: "Celiaco",
  other: "Altra"
};

const SWIM_LABELS: Record<string, string> = {
  none: "Nessuna",
  basic: "Base",
  confident: "Buona"
};

const TETANUS_LABELS: Record<string, string> = {
  unknown: "Non so",
  vaccinated: "Vaccinato/a",
  not_vaccinated: "Non vaccinato/a"
};

const ARRIVAL_LABELS: Record<string, string> = {
  own_car: "Auto propria",
  train: "Treno",
  bus: "Autobus",
  plane_crotone: "Aereo — Crotone",
  plane_lamezia: "Aereo — Lamezia",
  need_pickup: "Trasferimento richiesto"
};

function Row({ label, value, warn }: { label: string; value: string | boolean | null | undefined; warn?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  const display = value === true ? "Sì" : value === false ? "No" : String(value);
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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const close = () => setOpen(false);

  const birth = new Date(iscrizione.birthDate);
  // Use camp start date (June 21, 2026) as reference for age — that's what matters for the camp
  const campStart = new Date("2026-06-21");
  let age = campStart.getFullYear() - birth.getFullYear();
  const hadBday = campStart.getMonth() > birth.getMonth() || (campStart.getMonth() === birth.getMonth() && campStart.getDate() >= birth.getDate());
  if (!hadBday) age--;
  const birthFormatted = birth.toLocaleDateString("it-IT");

  // Additional turns
  const isMultiTurn = !!iscrizione.additionalTurns;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-ink hover:text-wwf-green p-1"
        aria-label="Vedi dettagli"
        title="Vedi tutti i dettagli"
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
                  {STATUS_LABELS[iscrizione.status] || iscrizione.status}
                </span>
                {iscrizione.isMinor && <span className="tag tag-orange">minore</span>}
                {isMultiTurn && <span className="tag tag-blue">multi-turno</span>}
              </div>
              <p className="text-sm text-ink-grey">
                Campo {iscrizione.turnoNumber} · {new Date(iscrizione.turnoStart).toLocaleDateString("it-IT")} → {new Date(iscrizione.turnoEnd).toLocaleDateString("it-IT")}
                {" · "}{age} anni
              </p>
            </div>
            <button onClick={close} className="text-ink-grey hover:text-ink shrink-0">
              <X size={24} />
            </button>
          </div>

          {/* Payment status banner */}
          <div className="flex gap-2 mb-4">
            <span className={`tag ${iscrizione.feePaid ? "tag-green" : "tag-red"}`}>
              Quota 100€: {iscrizione.feePaid ? "✓ Pagata" : "✗ Non pagata"}
              {iscrizione.feePaidDate && ` (${new Date(iscrizione.feePaidDate).toLocaleDateString("it-IT")})`}
            </span>
            <span className={`tag ${iscrizione.balancePaid ? "tag-green" : "tag-red"}`}>
              Saldo: {iscrizione.balancePaid ? "✓ Pagato" : "✗ Non pagato"}
              {iscrizione.balancePaidDate && ` (${new Date(iscrizione.balancePaidDate).toLocaleDateString("it-IT")})`}
            </span>
          </div>

          {/* Image consent warning */}
          {!iscrizione.imageDataConsent && (
            <div className="flex items-center gap-2 p-3 bg-wwf-red/10 border-l-4 border-wwf-red">
              <span className="text-wwf-red font-bold text-sm">⚠ NO CONSENSO IMMAGINI</span>
              <span className="text-wwf-red text-xs">— non fotografare/filmare questo volontario</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="p-6 pt-4 overflow-y-auto">
          <div>
            {/* Contatti */}
            <Section title="Contatti">
              <Row label="Email" value={iscrizione.email} />
              <Row label="Telefono" value={iscrizione.phone} />
              <Row label="Data di nascita" value={birthFormatted} />
            </Section>

            {/* Genitore (se minore) */}
            {iscrizione.isMinor && (
              <Section title="Genitore / Tutore">
                <Row label="Nome" value={iscrizione.guardianName} />
                <Row label="Email" value={iscrizione.guardianEmail} />
                <Row label="Telefono" value={iscrizione.guardianPhone} />
                <Row label="Consenso" value={iscrizione.guardianConsent ? "Firmato" : "Mancante"} warn={!iscrizione.guardianConsent} />
              </Section>
            )}

            {/* Salute */}
            <Section title="Salute">
              <Row label="Allergie" value={iscrizione.allergies} warn={!!iscrizione.allergies} />
              <Row label="Farmaci" value={iscrizione.medications} />
              <Row label="Nuoto" value={iscrizione.swimmingAbility ? SWIM_LABELS[iscrizione.swimmingAbility] : null} />
              <Row label="Tetano" value={iscrizione.tetanusStatus ? TETANUS_LABELS[iscrizione.tetanusStatus] : null} />
              <Row label="Forma fisica" value={iscrizione.fitnessSelf} />
            </Section>

            {/* Dieta */}
            <Section title="Dieta">
              <Row label="Esigenze" value={iscrizione.dietaryNeeds && iscrizione.dietaryNeeds !== "none" ? DIET_LABELS[iscrizione.dietaryNeeds] : "Nessuna"} />
              <Row label="Note dieta" value={iscrizione.dietaryNotes} />
            </Section>

            {/* Logistica */}
            <Section title="Logistica">
              <Row label="Arrivo" value={iscrizione.arrivalMode ? ARRIVAL_LABELS[iscrizione.arrivalMode] : null} />
              <Row label="Orario arrivo" value={iscrizione.arrivalTime} />
              <Row label="Orario partenza" value={iscrizione.departureTime} />
              <Row label="Taglia T-shirt" value={iscrizione.tshirtSize} />
              {isMultiTurn && <Row label="Turni extra" value={`Iscritto anche a: ${iscrizione.additionalTurns}`} />}
            </Section>

            {/* Consensi */}
            <Section title="Consensi">
              <Row label="Privacy" value={iscrizione.privacyConsent} warn={!iscrizione.privacyConsent} />
              <Row label="Marketing" value={iscrizione.marketingConsent} />
              <Row label="Immagini" value={iscrizione.imageDataConsent} warn={!iscrizione.imageDataConsent} />
            </Section>

            {/* Note admin */}
            <Section title="Note admin">
              <Row label="Note" value={iscrizione.notes} />
              <Row label="Iscritto il" value={new Date(iscrizione.createdAt).toLocaleDateString("it-IT")} />
            </Section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}