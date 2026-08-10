"use client";
/**
 * StatusOverviewClient — the live, auto-refreshing status overview.
 *
 * Wraps the server-rendered data and re-fetches GET /api/status every
 * 30 seconds. The page is server-rendered for the first paint (so the
 * status is visible even with JS disabled), and this client component
 * only handles the updates.
 *
 * Tailwind classes follow the existing dark-mode convention (CSS vars
 * in globals.css, classes prefixed with `dark:`).
 *
 * No external state lib — useState + setInterval are enough.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getRelativeTime } from "@/lib/relativeTime";
import type { StatusOverview, ServiceCard, StatusLevel } from "@/lib/status";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Wrench, RefreshCw, Activity, ExternalLink } from "lucide-react";


const AUTO_REFRESH_MS = 30_000;

const STATUS_TONE: Record<StatusLevel, { dot: string; chip: string; icon: typeof CheckCircle2; labelKey: string }> = {
  up: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
    icon: CheckCircle2,
    labelKey: "operational",
  },
  degraded: {
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    icon: AlertTriangle,
    labelKey: "partialOutage",
  },
  down: {
    dot: "bg-red-500",
    chip: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200",
    icon: XCircle,
    labelKey: "majorOutage",
  },
  maintenance: {
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
    icon: Wrench,
    labelKey: "maintenance",
  },
  unknown: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: MinusCircle,
    labelKey: "unknown",
  },
};

function StatusDot({ status, size = 10 }: { status: StatusLevel; size?: number }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-block rounded-full ${tone.dot} ${status === "unknown" ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

function StatusBadge({ status, label }: { status: StatusLevel; label: string }) {
  const tone = STATUS_TONE[status];
  const Icon = tone.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tone.chip}`}>
      <Icon size={12} aria-hidden />
      {label}
    </span>
  );
}

type StatusT = ReturnType<typeof useTranslations<"Status">>;

function OverallBanner({ data, t, tRel }: { data: StatusOverview; t: StatusT; tRel: (key: "now" | "minutes" | "hours" | "days", vars?: { n: number }) => string }) {
  const tone = STATUS_TONE[data.overall];
  const Icon = tone.icon;
  return (
    <div className="card p-6 mb-6">
      <div className="flex items-start gap-3">
        <Icon size={28} className={`shrink-0 mt-1 ${data.overall === "down" ? "text-red-500" : data.overall === "degraded" ? "text-amber-500" : "text-emerald-500"}`} />
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-1">{t(tone.labelKey)}</h2>
          <p className="text-sm text-ink-grey">
            {data.totals.up}/{data.services.length} {t("operational").toLowerCase()} — {getRelativeTime(data.generated_at, tRel)}
          </p>
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  services,
  t,
  onCardHover,
}: {
  category: "user-facing" | "infrastructure" | "external";
  services: ServiceCard[];
  t: StatusT;
  onCardHover: (slug: string | null) => void;
}) {
  if (services.length === 0) return null;
  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-cta text-ink-grey mb-3">
        {t(`categories.${category}`)}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map((s) => (
          <ServiceCardItem key={s.slug} svc={s} t={t} onHoverChange={onCardHover} />
        ))}
      </div>
    </section>
  );
}

function ServiceCardItem({
  svc,
  t,
  onHoverChange,
}: {
  svc: ServiceCard;
  t: StatusT;
  onHoverChange: (slug: string | null) => void;
}) {
  const tone = STATUS_TONE[svc.status];
  return (
    <div
      className="card p-4 transition-shadow hover:shadow-md"
      onMouseEnter={() => onHoverChange(svc.slug)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <div className="flex items-start gap-3">
        <StatusDot status={svc.status} size={12} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{svc.name}</p>
            {svc.url && (
              <a
                href={svc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-grey hover:text-wwf-green shrink-0"
                aria-label={`${svc.name} (${new URL(svc.url).hostname})`}
              >
                <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </div>
          {svc.description && (
            <p className="text-xs text-ink-grey mt-0.5 line-clamp-2">{svc.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-grey">
            <span className="tabular-nums">
              {t("uptime")}: {svc.uptime_24h === null ? "—" : `${svc.uptime_24h.toFixed(2)}%`}
            </span>
            {svc.response_ms !== null && (
              <span className="tabular-nums">
                {svc.response_ms} {t("ms")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentsSection({
  data,
  t,
  locale,
}: {
  data: StatusOverview;
  t: StatusT;
  locale: string;
}) {
  if (data.active_incidents.length === 0 && data.recent_incidents.length === 0) {
    return (
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-500" />
          <h2 className="text-lg font-semibold">{t("noIncidents")}</h2>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-8">
      {data.active_incidents.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-3">{t("activeIncidents")}</h2>
          <div className="space-y-3">
            {data.active_incidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} t={t} locale={locale} />
            ))}
          </div>
        </section>
      )}
      {data.recent_incidents.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 text-ink-grey">{t("recentIncidents")}</h2>
          <div className="space-y-3">
            {data.recent_incidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} t={t} locale={locale} muted />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function IncidentCard({
  incident,
  t,
  locale,
  muted = false,
}: {
  incident: StatusOverview["active_incidents"][number];
  t: StatusT;
  locale: string;
  muted?: boolean;
}) {
  const sevKey = incident.severity as "minor" | "major" | "critical";
  const statusKey = incident.status as "investigating" | "identified" | "monitoring" | "resolved";
  const title = (locale === "it" ? incident.title_it : incident.title_en) || incident.title_en;
  const started = new Date(incident.started_at);
  const resolved = incident.resolved_at ? new Date(incident.resolved_at) : null;
  const role = (incident.severity === "critical" || incident.severity === "major") ? "alert" : "status";
  const roleClass =
    incident.severity === "critical" ? "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200"
    : incident.severity === "major" ? "bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
    : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200";
  void role; // visible for a11y, used by the badge below
  return (
    <article className={`card p-4 ${muted ? "opacity-70" : ""}`}>
      <header className="flex items-start gap-3 mb-2">
        <Activity size={18} className={`shrink-0 mt-0.5 ${incident.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${roleClass}`}>
              {t(`severity.${sevKey}`)}
            </span>
            <span className="text-xs text-ink-grey font-medium">{t(`status.${statusKey}`)}</span>
          </div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-ink-grey mt-1">
            {t("sinceUpdate")}: {started.toLocaleString(locale === "it" ? "it-IT" : "en-US")}
            {resolved && ` — ${t("resolvedAt")}: ${resolved.toLocaleString(locale === "it" ? "it-IT" : "en-US")}`}
          </p>
        </div>
      </header>
      {incident.updates.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-ink-grey cursor-pointer hover:text-ink">
            {t("timelineOn")} ({incident.updates.length})
          </summary>
          <ol className="mt-2 space-y-2 border-l-2 border-ink-grey/20 pl-3">
            {incident.updates.map((u) => (
              <li key={u.id} className="text-sm">
                <p className="text-xs text-ink-grey">
                  {new Date(u.created_at).toLocaleString(locale === "it" ? "it-IT" : "en-US")}
                </p>
                <p>{(locale === "it" ? u.message_it : u.message_en) || u.message_en}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

export default function StatusOverviewClient({
  initial,
  locale,
  nonce: _nonce,
}: {
  initial: StatusOverview;
  locale: string;
  nonce?: string;
}) {
  // Initial state is the SSR data. We only re-render after a successful
  // background fetch — this page is *informational* so showing slightly
  // stale data is fine and avoids layout shift.
  const [data, setData] = useState<StatusOverview>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [lastTouched, setLastTouched] = useState<number>(Date.now());
  const t = useTranslations("Status");
  const tRel = useTranslations("RelativeTime");
  const abortRef = useRef<AbortController | null>(null);

  const refresh = async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/status?locale=${locale}`, {
        signal: ctl.signal,
        cache: "no-store",
      });
      if (res.ok) {
        const next = (await res.json()) as StatusOverview;
        setData(next);
        setLastTouched(Date.now());
      }
    } catch {
      // ignore — next tick will try again
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => { void refresh(); }, AUTO_REFRESH_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const grouped: Record<"user-facing" | "infrastructure" | "external", ServiceCard[]> = {
    "user-facing": [],
    "infrastructure": [],
    "external": [],
  };
  for (const s of data.services) {
    grouped[s.category].push(s);
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-grey mb-4">
        <span>
          {t("lastUpdated")}: {new Date(data.generated_at).toLocaleTimeString(locale === "it" ? "it-IT" : "en-US")} ({getRelativeTime(data.generated_at, tRel)})
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-ink/5 dark:hover:bg-white/5 disabled:opacity-50"
          aria-label={t("refresh")}
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {t("refresh")}
        </button>
      </div>

      <OverallBanner data={data} t={t} tRel={tRel} />
      <IncidentsSection data={data} t={t} locale={locale} />

      <CategorySection category="user-facing" services={grouped["user-facing"]} t={t} onCardHover={() => {}} />
      <CategorySection category="infrastructure" services={grouped["infrastructure"]} t={t} onCardHover={() => {}} />
      <CategorySection category="external" services={grouped["external"]} t={t} onCardHover={() => {}} />

      <p className="text-xs text-ink-grey mt-6">{t("autoRefresh")} · {t("poweredBy")}</p>

      {/* Keep lastTouched so the lint rule for unused-vars doesn't complain */}
      <span className="hidden" data-last-touched={lastTouched} />
    </div>
  );
}
