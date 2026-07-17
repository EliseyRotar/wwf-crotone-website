"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteVolunteer({ id, name }: { id: string; name: string }) {
  const router = useRouter();

  const del = async () => {
    if (!confirm(`Eliminare definitivamente ${name}? Questa azione non può essere annullata.`)) return;
    try {
      const res = await fetch("/api/admin/iscrizioni", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.ok) {
        router.refresh();
      } else {
        alert("Errore: " + (json.error || "unknown"));
      }
    } catch {
      alert("Errore di rete");
    }
  };

  return (
    <button
      onClick={del}
      className="text-wwf-red hover:bg-wwf-red/10 p-1"
      aria-label="Elimina volontario"
      title="Elimina volontario"
    >
      <Trash2 size={15} />
    </button>
  );
}