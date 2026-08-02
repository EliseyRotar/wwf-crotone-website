"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";

export default function MyRegistrationClient() {
  const t = useTranslations("MyRegistration");
  const tIsc = useTranslations("Admin.iscrizioni");
  const loc = useLocale();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ ok: boolean; iscrizioni?: unknown[] } | null>(null);

  // C-03: the lookup endpoint is now authenticated via the HMAC-signed
  // cookie set at registration completion. The volunteer does not need to
  // enter an email — we just call the endpoint and let the cookie carry
  // the auth. If the cookie is missing or expired, the endpoint returns
  // 200 with an empty array (intentional — no enumeration).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/iscrizione/lookup", { credentials: "include" });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container section max-w-2xl">
      <h1 className="text-3xl md:text-4xl mb-3">{t("title")}</h1>
      <p className="text-ink-2 mb-8">{t("intro")}</p>

      {loading && (
        <p className="text-ink-grey flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> …
        </p>
      )}

      {!loading && data && data.ok && Array.isArray(data.iscrizioni) && data.iscrizioni.length === 0 && (
        <div className="card"><div className="card-body">
          <p className="text-ink-2">{t("notFound")}</p>
        </div></div>
      )}

      {!loading && data && data.ok && Array.isArray(data.iscrizioni) && data.iscrizioni.length > 0 && (
        <div className="space-y-4">
          {(data.iscrizioni as Array<Record<string, unknown>>).map((isc, i) => {
            const status = isc.status as string;
            const statusKey = ({
              pending: "statusPending",
              confirmed: "statusConfirmed",
              paid: "statusPaid",
              waitlist: "statusWaitlist",
              cancelled: "statusCancelled"
            } as Record<string, string>)[status] || "statusPending";
            const colorByStatus: Record<string, string> = {
              pending: "tag-grey", confirmed: "tag-blue", paid: "tag-green",
              waitlist: "tag-orange", cancelled: "tag-red"
            };
            const fmtDate = (s: string) =>
              new Date(s).toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
              });
            return (
              <div key={i} className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg">{t("campLabel")} {isc.turnoNumber as number}</h3>
                    <span className={`tag ${colorByStatus[status] || "tag-grey"}`}>
                      {tIsc(statusKey)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-2 mb-3">
                    {fmtDate(isc.turnoStart as string)} → {fmtDate(isc.turnoEnd as string)}
                  </p>
                  <div className="flex gap-2">
                    <span className={`tag ${isc.feePaid ? "tag-green" : "tag-red"}`}>
                      {t("fee100")}: {isc.feePaid ? "✓" : "✗"}
                    </span>
                    <span className={`tag ${isc.balancePaid ? "tag-green" : "tag-red"}`}>
                      {t("balance")}: {isc.balancePaid ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
