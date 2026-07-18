"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, Check, X, Clock, FileText } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; color: string; icon: typeof Clock }> = {
  pending: { label: "In attesa", labelEn: "Pending", color: "tag-grey", icon: Clock },
  confirmed: { label: "Confermato", labelEn: "Confirmed", color: "tag-blue", icon: Check },
  paid: { label: "Pagato", labelEn: "Paid", color: "tag-green", icon: Check },
  waitlist: { label: "Lista d'attesa", labelEn: "Waitlist", color: "tag-orange", icon: Clock },
  cancelled: { label: "Annullato", labelEn: "Cancelled", color: "tag-red", icon: X }
};

export default function MyRegistrationClient() {
  const t = useTranslations("Nav");
  const loc = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ ok: boolean; iscrizioni?: unknown[]; error?: string } | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/iscrizione/lookup?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData({ ok: false, error: "network" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container section max-w-2xl">
      <h1 className="text-3xl md:text-4xl mb-3">{loc === "it" ? "La mia iscrizione" : "My registration"}</h1>
      <p className="text-ink-2 mb-8">
        {loc === "it"
          ? "Inserisci la tua email per vedere lo stato della tua iscrizione."
          : "Enter your email to check your registration status."}
      </p>

      <form onSubmit={search} className="flex gap-2 mb-8">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={loc === "it" ? "La tua email" : "Your email"}
          required
          className="flex-1 px-4 py-3 border-2 border-ink-grey-light bg-surface text-ink focus:border-wwf-green focus:outline-none"
        />
        <button type="submit" disabled={loading} className="btn btn-green">
          <Search size={18} /> {loc === "it" ? "Cerca" : "Search"}
        </button>
      </form>

      {loading && <p className="text-ink-grey">…</p>}

      {data && !data.ok && (
        <div className="card"><div className="card-body">
          <p className="text-ink-2">
            {data.error === "not-found"
              ? (loc === "it" ? "Nessuna iscrizione trovata con questa email." : "No registration found with this email.")
              : (loc === "it" ? "Errore. Riprova." : "Error. Try again.")}
          </p>
        </div></div>
      )}

      {data && data.ok && data.iscrizioni && (
        <div className="space-y-4">
          {(data.iscrizioni as Array<Record<string, unknown>>).map((isc, i) => {
            const status = isc.status as string;
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const fmtDate = (s: string) => new Date(s).toLocaleDateString(loc === "it" ? "it-IT" : "en-GB");
            return (
              <div key={i} className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg">{loc === "it" ? "Campo" : "Camp"} {isc.turnoNumber as number}</h3>
                    <span className={`tag ${cfg.color}`}>
                      <StatusIcon size={14} className="mr-1" />
                      {loc === "it" ? cfg.label : cfg.labelEn}
                    </span>
                  </div>
                  <p className="text-sm text-ink-2 mb-3">
                    {fmtDate(isc.turnoStart as string)} → {fmtDate(isc.turnoEnd as string)}
                  </p>
                  <div className="flex gap-2 mb-3">
                    <span className={`tag ${isc.feePaid ? "tag-green" : "tag-red"}`}>
                      {loc === "it" ? "Quota 100€" : "Fee €100"}: {isc.feePaid ? "✓" : "✗"}
                    </span>
                    <span className={`tag ${isc.balancePaid ? "tag-green" : "tag-red"}`}>
                      {loc === "it" ? "Saldo" : "Balance"}: {isc.balancePaid ? "✓" : "✗"}
                    </span>
                  </div>
                  {isc.hasReceipt ? (
                    <a href={isc.receiptUrl as string} target="_blank" rel="noopener noreferrer" className="cta-text">
                      <FileText size={14} /> {loc === "it" ? "Vedi ricevuta" : "View receipt"}
                    </a>
                  ) : (
                    <p className="text-xs text-ink-grey">
                      {loc === "it" ? "Nessuna ricevuta caricata" : "No receipt uploaded"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}