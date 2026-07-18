"use client";

import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

type Iscrizione = {
  id: string; firstName: string; lastName: string; isMinor: boolean;
  phone: string; email: string; dietaryNeeds: string | null;
  allergies: string | null; arrivalMode: string | null; arrivalTime: string | null;
  feePaid: boolean; balancePaid: boolean;
};

const DIET: Record<string, string> = { none: "", vegetarian: "VEG", vegan: "VEG", celiac: "CEL", other: "ALT" };
const ARRIVAL: Record<string, string> = {
  own_car: "Auto", train: "Treno", bus: "Bus",
  plane_crotone: "Aereo CR", plane_lamezia: "Aereo LT", need_pickup: "Trasf."
};

export default function RosterClient({ turni, selectedTurnoId, iscrizioni }: {
  turni: { id: string; number: number; start: string; end: string }[];
  selectedTurnoId: string;
  iscrizioni: Iscrizione[];
}) {
  const router = useRouter();
  const selected = turni.find((t) => t.id === selectedTurnoId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl">Roster turno</h1>
        <button onClick={() => window.print()} className="btn btn-outline">
          <Printer size={18} /> Stampa
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {turni.map((t) => (
          <button
            key={t.id}
            onClick={() => router.push(`/admin/roster?turno=${t.id}`)}
            className={`tag ${t.id === selectedTurnoId ? "tag-green" : "tag-grey"}`}
          >
            C{t.number}
          </button>
        ))}
      </div>

      {selected && (
        <h2 className="text-xl mb-4">
          Campo {selected.number} — {new Date(selected.start).toLocaleDateString("it-IT")} → {new Date(selected.end).toLocaleDateString("it-IT")}
          <span className="text-ink-grey text-sm ml-2">({iscrizioni.length} volontari)</span>
        </h2>
      )}

      <div className="card overflow-x-auto print-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-grey-light text-left">
              <th className="p-2">#</th>
              <th className="p-2">Nome</th>
              <th className="p-2">Tel</th>
              <th className="p-2">Dieta</th>
              <th className="p-2">Allergie</th>
              <th className="p-2">Arrivo</th>
              <th className="p-2">Ora</th>
              <th className="p-2">Pag.</th>
            </tr>
          </thead>
          <tbody>
            {iscrizioni.map((i, idx) => (
              <tr key={i.id} className="border-b border-ink-grey-light/40">
                <td className="p-2 text-ink-grey">{idx + 1}</td>
                <td className="p-2 font-bold">
                  {i.firstName} {i.lastName}
                  {i.isMinor && <span className="tag tag-orange ml-1 text-xs">min</span>}
                </td>
                <td className="p-2 text-xs">{i.phone}</td>
                <td className="p-2 text-xs">{i.dietaryNeeds ? DIET[i.dietaryNeeds] || i.dietaryNeeds : ""}</td>
                <td className="p-2 text-xs text-wwf-red">{i.allergies || ""}</td>
                <td className="p-2 text-xs">{i.arrivalMode ? ARRIVAL[i.arrivalMode] || "" : ""}</td>
                <td className="p-2 text-xs">{i.arrivalTime || ""}</td>
                <td className="p-2">
                  <span className={`tag ${i.feePaid && i.balancePaid ? "tag-green" : i.feePaid ? "tag-orange" : "tag-red"} text-xs`}>
                    {i.feePaid && i.balancePaid ? "OK" : i.feePaid ? "100€" : "✗"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-card, .print-card * { visibility: visible; }
          .print-card { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
        }
      `}</style>
    </div>
  );
}