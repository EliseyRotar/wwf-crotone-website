"use client";

import { useEffect, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

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
 * F1: Live availability counter.
 * Polls /api/availability every 30s and shows the remaining spots for each
 * active turn. Visually indicates "few spots" (<=3) and "just booked".
 */
export default function LiveAvailability({
  initial
}: {
  initial: { id: string; number: number; booked: number; capacity: number; isPast: boolean }[];
}) {
  const loc = useLocale();
  const t = useTranslations("Dates");
  const [turni, setTurni] = useState<TurnLive[]>(() =>
    initial.map((t) => ({
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      booked: t.booked,
      remaining: Math.max(0, t.capacity - t.booked),
      isPast: t.isPast
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
          // Detect "just booked" — any turn with new bookings since last poll
          const prevMap = new Map(prev.map((p) => [p.id, p.booked]));
          const changed = json.turni.some((t: TurnLive) => prevMap.get(t.id) !== t.booked);
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

  const labelRemaining = (n: number) =>
    t(n === 1 ? "spotsOne" : "spotsOther", { n });

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
        {turni.map((t) => {
          if (t.isPast) return null;
          const tone = t.remaining === 0
            ? "tag-red"
            : t.remaining <= 3
              ? "tag-orange"
              : "tag-green";
          return (
            <li key={t.id} className={`tag ${tone}`}>
              C{t.number} · {labelRemaining(t.remaining)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
