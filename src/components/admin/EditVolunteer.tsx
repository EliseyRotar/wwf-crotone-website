"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

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
  balancePaid: boolean;
  notes: string | null;
  imageDataConsent: boolean;
};

export default function EditVolunteer({ iscrizione }: { iscrizione: Iscrizione }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const close = () => setOpen(false);

  const [data, setData] = useState<Record<string, string | boolean>>({
    firstName: iscrizione.firstName,
    lastName: iscrizione.lastName,
    birthDate: iscrizione.birthDate.slice(0, 10),
    email: iscrizione.email,
    phone: iscrizione.phone,
    isMinor: iscrizione.isMinor,
    guardianName: iscrizione.guardianName || "",
    guardianEmail: iscrizione.guardianEmail || "",
    guardianPhone: iscrizione.guardianPhone || "",
    allergies: iscrizione.allergies || "",
    medications: iscrizione.medications || "",
    swimmingAbility: iscrizione.swimmingAbility || "",
    tetanusStatus: iscrizione.tetanusStatus || "",
    fitnessSelf: iscrizione.fitnessSelf || "",
    dietaryNeeds: iscrizione.dietaryNeeds || "none",
    dietaryNotes: iscrizione.dietaryNotes || "",
    tshirtSize: iscrizione.tshirtSize || "",
    arrivalMode: iscrizione.arrivalMode || "",
    arrivalTime: iscrizione.arrivalTime || "",
    departureTime: iscrizione.departureTime || "",
    status: iscrizione.status,
    feePaid: iscrizione.feePaid,
    balancePaid: iscrizione.balancePaid,
    notes: iscrizione.notes || "",
    imageDataConsent: iscrizione.imageDataConsent
  });

  const set = (k: string, v: string | boolean) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/iscrizioni/manual", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: iscrizione.id, ...data })
      });
      const json = await res.json();
      if (json.ok) {
        close();
        router.refresh();
      } else {
        setErr("Errore: " + (json.error || "unknown"));
      }
    } catch {
      setErr("Errore di rete");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-ink hover:text-wwf-green p-1"
        aria-label="Modifica"
        title="Modifica volontario"
      >
        <Pencil size={15} />
      </button>
    );
  }

  return createPortal(
    <>
      {/* Modal overlay */}
      <div
        className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
        onClick={close}
      >
        <div
          className="card bg-surface max-w-2xl w-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 pb-4 border-b border-ink-grey-light shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Modifica volontario</h2>
              <button onClick={close} className="text-ink-grey hover:text-ink">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto">
            <div className="grid sm:grid-cols-2 gap-x-4">
              <div className="field">
                <label>Nome</label>
                <input value={String(data.firstName)} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="field">
                <label>Cognome</label>
                <input value={String(data.lastName)} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <div className="field">
                <label>Data di nascita</label>
                <input type="date" value={String(data.birthDate)} onChange={(e) => set("birthDate", e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={String(data.email)} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="field">
                <label>Telefono</label>
                <input type="tel" value={String(data.phone)} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="field">
                <label>Stato</label>
                <select value={String(data.status)} onChange={(e) => set("status", e.target.value)}>
                  <option value="pending">In attesa</option>
                  <option value="confirmed">Confermato</option>
                  <option value="paid">Pagato</option>
                  <option value="waitlist">Lista d&apos;attesa</option>
                  <option value="cancelled">Annullato</option>
                </select>
              </div>
              <div className="field">
                <label>Dieta</label>
                <select value={String(data.dietaryNeeds)} onChange={(e) => set("dietaryNeeds", e.target.value)}>
                  <option value="none">Nessuna</option>
                  <option value="vegetarian">Vegetariano</option>
                  <option value="vegan">Vegano</option>
                  <option value="celiac">Celiaco</option>
                  <option value="other">Altra</option>
                </select>
              </div>
              <div className="field">
                <label>Taglia T-shirt</label>
                <select value={String(data.tshirtSize)} onChange={(e) => set("tshirtSize", e.target.value)}>
                  <option value="">—</option>
                  {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Allergie</label>
                <input value={String(data.allergies)} onChange={(e) => set("allergies", e.target.value)} />
              </div>
              <div className="field">
                <label>Farmaci</label>
                <input value={String(data.medications)} onChange={(e) => set("medications", e.target.value)} />
              </div>
              <div className="field">
                <label>Modalità arrivo</label>
                <select value={String(data.arrivalMode)} onChange={(e) => set("arrivalMode", e.target.value)}>
                  <option value="">—</option>
                  <option value="own_car">Auto propria</option>
                  <option value="train">Treno</option>
                  <option value="bus">Autobus</option>
                  <option value="plane_crotone">Aereo — Crotone</option>
                  <option value="plane_lamezia">Aereo — Lamezia</option>
                  <option value="need_pickup">Trasferimento</option>
                </select>
              </div>
              <div className="field">
                <label>Orario arrivo</label>
                <input type="time" value={String(data.arrivalTime)} onChange={(e) => set("arrivalTime", e.target.value)} />
              </div>
              <div className="field">
                <label>Orario partenza</label>
                <input type="time" value={String(data.departureTime)} onChange={(e) => set("departureTime", e.target.value)} />
              </div>
              <div className="field">
                <label>Genitore (se minore)</label>
                <input value={String(data.guardianName)} onChange={(e) => set("guardianName", e.target.value)} />
              </div>
              <div className="field">
                <label>Telefono genitore</label>
                <input type="tel" value={String(data.guardianPhone)} onChange={(e) => set("guardianPhone", e.target.value)} />
              </div>
              <div className="field sm:col-span-2">
                <label>Note admin</label>
                <input value={String(data.notes)} onChange={(e) => set("notes", e.target.value)} />
              </div>
              <div className="field sm:col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(data.feePaid)} onChange={(e) => set("feePaid", e.target.checked)} />
                  Quota 100€ pagata
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(data.balancePaid)} onChange={(e) => set("balancePaid", e.target.checked)} />
                  Saldo pagato
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(data.imageDataConsent)} onChange={(e) => set("imageDataConsent", e.target.checked)} />
                  Consenso immagini
                </label>
              </div>
            </div>

            {err && <p className="field-error mt-3">{err}</p>}

            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={busy} className="btn btn-green">
                {busy ? "…" : "Salva modifiche"}
              </button>
              <button onClick={close} className="btn btn-outline">
                Annulla
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}