"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";

export default function BulkEmailButton({ turnoId }: { turnoId?: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    if (!subject || !body) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, turnoId, locale: "it" })
      });
      const json = await res.json();
      if (json.ok) {
        setMsg(`Email inviata a ${json.sent} volontari.`);
        setSubject(""); setBody("");
        setTimeout(() => { setOpen(false); setMsg(null); }, 2000);
      } else {
        setMsg("Errore: " + (json.error || "unknown"));
      }
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-outline">
        <Mail size={18} /> Email a volontari di questo turno
      </button>
    );
  }

  return (
    <div className="card max-w-xl">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg">Email a volontari</h3>
          <button onClick={() => setOpen(false)} className="text-ink-grey hover:text-ink"><X size={20} /></button>
        </div>
        <div className="field">
          <label>Oggetto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="es. Promemoria: cosa portare al campo" />
        </div>
        <div className="field">
          <label>Messaggio</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Scrivi qui il messaggio..." />
        </div>
        {msg && <p className="text-sm mt-2 text-ink-2">{msg}</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={send} disabled={busy} className="btn btn-green">{busy ? "…" : "Invia"}</button>
          <button onClick={() => setOpen(false)} className="btn btn-outline">Annulla</button>
        </div>
      </div>
    </div>
  );
}