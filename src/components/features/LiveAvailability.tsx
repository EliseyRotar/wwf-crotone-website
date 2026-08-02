"use client";

import { useEffect, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Users } from "lucide-react";

type TurnLive = {
  id: string;
  number: number;
  capacity: number;
  booked: number;
  remaining: number;
  isPast: boolean;
};

const POLL_MS = 30_000;

/**
 * Live availability counter.
 *
 * Design decision: we deliberately do NOT show "20 posti liberi" because
 * an empty-looking count backfires — volunteers read it as "nobody is
 * going, the field must be bad, I'll skip it too". Instead we show:
 *
 *   - full turn:               "Completo" / "Full" (red)
 *   - last 1–3 spots:          "Pochi posti rimasti" / "Only X spots left" (orange)
 *   - 4+ spots:                "N iscritti" / "N already going" (green, social proof)
 *
 * That way the page never reveals "0 are going" when the field is empty
 * — it just quietly says "people are going", which is the psychological
 * signal we want to send.
 */
export default function LiveAvailability({
  initial
}: {
  initial: { id: string; number: number; booked: number; capacity: number; isPast: boolean }[];
}) {
  const loc = useLocale();
  const t = useTranslations("Dates");
  const [turni, setTurni] = useState<TurnLive[]>(() =>
    initial.map((tt) => ({
      id: tt.id,
      number: tt.number,
      capacity: tt.capacity,
      booked: tt.booked,
      remaining: Math.max(0, tt.capacity - tt.booked),
      isPast: tt.isPast
    }))
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    const fetchOnce = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        const json = await res.json();
        if (cancelled || !json.ok) return;
        setTurni((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p.booked]));
          const changed = json.turni.some((tt: TurnLive) => prevMap.get(tt.id) !== tt.booked);
          if (changed && mounted.current) {
            setPulse(true);
            setTimeout(() => setPulse(false), 1500);
          }
          return json.turni;
        });
        setUpdatedAt(json.updatedAt);
      } catch {
        /* swallow — keep last known state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const interval = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`mt-4 transition-colors ${pulse ? "ring-2 ring-wwf-green/40 rounded-md" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-ink-grey mb-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${loading ? "bg-wwf-orange animate-pulse" : "bg-wwf-green"}`}
          aria-hidden="true"
        />
        <span>
          {t("liveTitle")}
          {updatedAt && (
            <span className="ml-2 opacity-60">
              · {t("liveUpdate")} {new Date(updatedAt).toLocaleTimeString(loc === "it" ? "it-IT" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </span>
        {loading && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
      </div>
      <ul className="flex flex-wrap gap-2">
        {turni.map((tt) => {
          if (tt.isPast) return null;

          // Decide what to say based on remaining capacity.
          let tone: string;
          let label: string;

          if (tt.remaining === 0) {
            tone = "tag-red";
            label = t("full");
          } else if (tt.remaining <= 3) {
            tone = "tag-orange";
            label = t("fewLeft", { n: tt.remaining });
          } else {
            // Plenty of room → show social proof: "N iscritti" / "N going"
            tone = "tag-green";
            label = t(tt.booked === 1 ? "goingCountOne" : "goingCount", { n: tt.booked });
          }

          return (
            <li key={tt.id} className={`tag ${tone} inline-flex items-center gap-1.5`}>
              <span>C{tt.number}</span>
              <span aria-hidden="true">·</span>
              <Users size={12} className="opacity-70" />
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
