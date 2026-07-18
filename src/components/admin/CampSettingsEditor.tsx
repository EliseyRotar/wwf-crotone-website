"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type Settings = {
  year: number;
  startDate: string;
  endDate: string;
  numTurns: number;
  turnDurationDays: number;
  costNonMember: number;
  costMember: number;
  minorInsurance: number;
  registrationFee: number;
  iban: string;
  isActive: boolean;
};

export default function CampSettingsEditor({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const [data, setData] = useState<Settings>(settings ?? {
    year: 2026, startDate: "2026-06-21", endDate: "2026-09-13", numTurns: 12,
    turnDurationDays: 7, costNonMember: 430, costMember: 400, minorInsurance: 20,
    registrationFee: 100, iban: "IT30V0306909606100000107334", isActive: true
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof Settings, v: string | number | boolean) =>
    setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/camp-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.ok) {
        setMsg("Impostazioni salvate.");
        router.refresh();
      } else {
        setMsg("Errore: " + (json.error || "unknown"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl mb-1">Impostazioni campo</h1>
      <p className="text-ink-grey text-sm mb-8">Configura l&apos;anno, le date, il numero di turni e i costi per il campo.</p>

      <div className="card max-w-2xl">
        <div className="card-body">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="field">
              <label>Anno</label>
              <input type="number" value={data.year} onChange={(e) => set("year", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Numero di turni</label>
              <input type="number" value={data.numTurns} onChange={(e) => set("numTurns", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Data inizio (primo turno)</label>
              <input type="date" value={data.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="field">
              <label>Data fine (ultimo turno)</label>
              <input type="date" value={data.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div className="field">
              <label>Durata turno (giorni)</label>
              <input type="number" value={data.turnDurationDays} onChange={(e) => set("turnDurationDays", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Costo non socio (€)</label>
              <input type="number" value={data.costNonMember} onChange={(e) => set("costNonMember", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Costo socio (€)</label>
              <input type="number" value={data.costMember} onChange={(e) => set("costMember", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Assicurazione minori (€)</label>
              <input type="number" value={data.minorInsurance} onChange={(e) => set("minorInsurance", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Quota iscrizione (€)</label>
              <input type="number" value={data.registrationFee} onChange={(e) => set("registrationFee", Number(e.target.value))} />
            </div>
            <div className="field sm:col-span-2">
              <label>IBAN</label>
              <input value={data.iban} onChange={(e) => set("iban", e.target.value)} className="font-mono" />
            </div>
            <div className="field sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={data.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                Campo attivo (accetta iscrizioni)
              </label>
            </div>
          </div>
          {msg && <p className="text-sm mt-3 text-ink-2">{msg}</p>}
          <button onClick={save} disabled={busy} className="btn btn-green mt-4">
            <Save size={18} /> {busy ? "…" : "Salva impostazioni"}
          </button>
        </div>
      </div>
    </div>
  );
}