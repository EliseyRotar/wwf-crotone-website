/**
 * src/lib/status.ts — pure data layer for the status page.
 *
 * Reads from the status schema (StatusService, StatusSnapshot, StatusPeriod,
 * Incident) and produces the shape the public API + page need.
 *
 * The cron worker (scripts/status-poll.js) writes; this module only reads.
 * Cache headers are set on the API route, not here.
 */

import { prisma } from "@/lib/prisma";

export type StatusLevel = "up" | "down" | "degraded" | "unknown" | "maintenance";

export type ServiceCard = {
  slug: string;
  name: string;          // localized
  category: "user-facing" | "infrastructure" | "external";
  url: string | null;
  status: StatusLevel;
  description?: string;
  uptime_24h: number | null; // 0..100
  response_ms: number | null;
  updatedAt: string;     // ISO of last snapshot
};

export type IncidentPublic = {
  id: string;
  service_slug: string;
  severity: "minor" | "major" | "critical";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  title_it: string;
  title_en: string;
  started_at: string;
  resolved_at: string | null;
  updates: IncidentUpdatePublic[];
};

export type IncidentUpdatePublic = {
  id: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message_it: string;
  message_en: string;
  created_at: string;
};

export type StatusOverview = {
  overall: StatusLevel;
  totals: {
    up: number;
    down: number;
    degraded: number;
    maintenance: number;
    unknown: number;
  };
  by_category: Record<string, { up: number; down: number; degraded: number; total: number }>;
  services: ServiceCard[];
  active_incidents: IncidentPublic[];
  recent_incidents: IncidentPublic[];
  generated_at: string;
  // Optional: deeplink to the Instatus fallback page when our origin domain
  // is unavailable. We always set this to false now (status.wwfcrotone.it
  // is canonical), but the field is here so the UI can show a "fallback" hint
  // if we ever need to.
  canonical: "self-hosted" | "redirect-instatus";
};

const DEFAULT_LOOKBACK_HOURS = 24;

function pct(up: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((up / total) * 10000) / 100; // 2 decimal places
}

function rollupStatus(levels: StatusLevel[]): StatusLevel {
  if (levels.some((l) => l === "down")) return "down";
  if (levels.some((l) => l === "degraded")) return "degraded";
  if (levels.some((l) => l === "maintenance")) return "maintenance";
  if (levels.length > 0 && levels.every((l) => l === "up")) return "up";
  return "unknown";
}

function isItalian(locale: string): boolean {
  return locale.toLowerCase().startsWith("it");
}

function pickLocalized<T extends string>(
  it: T | null | undefined,
  en: T | null | undefined,
  locale: string
): T {
  if (isItalian(locale)) return (it ?? en ?? "") as T;
  return (en ?? it ?? "") as T;
}

/**
 * Read everything needed for an overview render in one shot.
 * Locale is used for picking name/description columns.
 *
 * Heavy queries: bounded by service count (~24) and snapshot lookback
 * (24h × 60s = 1440 samples per service = ~34k rows). Acceptable.
 */
export async function getStatusOverview(
  locale: string,
  lookbackHours: number = DEFAULT_LOOKBACK_HOURS
): Promise<StatusOverview> {
  const services = await prisma.statusService.findMany({
    where: { active: true },
    orderBy: [{ display_order: "asc" }],
  });

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Pull latest snapshot per service
  const latestByService = new Map<string, { status: StatusLevel; response_ms: number | null; taken_at: Date }>();
  // Pull 24h counts per service (single grouped query)
  const countsByService = new Map<string, { up: number; total: number }>();
  // Active incidents
  const activeIncidents = await prisma.incident.findMany({
    where: { resolved_at: null },
    include: { updates: { orderBy: { createdAt: "desc" } } },
    orderBy: { started_at: "desc" },
  });
  // Recently resolved incidents (last 7 days)
  const recentIncidents = await prisma.incident.findMany({
    where: {
      resolved_at: { not: null, gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: { updates: { orderBy: { createdAt: "desc" } } },
    orderBy: { resolved_at: "desc" },
    take: 10,
  });

  // For each service, fetch latest + counts in parallel
  await Promise.all(
    services.map(async (s) => {
      const [latest, counts] = await Promise.all([
        prisma.statusSnapshot.findFirst({
          where: { service_id: s.id },
          orderBy: { taken_at: "desc" },
        }),
        prisma.statusSnapshot.groupBy({
          by: ["status"],
          where: { service_id: s.id, taken_at: { gte: since } },
          _count: { _all: true },
        }),
      ]);

      if (latest) {
        latestByService.set(s.id, {
          status: latest.status as StatusLevel,
          response_ms: latest.response_ms,
          taken_at: latest.taken_at,
        });
      }

      let up = 0;
      let total = 0;
      for (const c of counts) {
        total += c._count._all;
        if (c.status === "up") up += c._count._all;
      }
      countsByService.set(s.id, { up, total });
    })
  );

  const cards: ServiceCard[] = services.map((s) => {
    const latest = latestByService.get(s.id);
    const counts = countsByService.get(s.id);
    return {
      slug: s.slug,
      name: pickLocalized(s.name_it, s.name_en, locale),
      category: s.category as ServiceCard["category"],
      url: s.url,
      status: (latest?.status ?? "unknown") as StatusLevel,
      description: pickLocalized(s.description_it, s.description_en, locale),
      uptime_24h: counts ? pct(counts.up, counts.total) : null,
      response_ms: latest?.response_ms ?? null,
      updatedAt: (latest?.taken_at ?? new Date()).toISOString(),
    };
  });

  const totals = {
    up: cards.filter((c) => c.status === "up").length,
    down: cards.filter((c) => c.status === "down").length,
    degraded: cards.filter((c) => c.status === "degraded").length,
    maintenance: cards.filter((c) => c.status === "maintenance").length,
    unknown: cards.filter((c) => c.status === "unknown").length,
  };

  const by_category: StatusOverview["by_category"] = {
    "user-facing": { up: 0, down: 0, degraded: 0, total: 0 },
    infrastructure: { up: 0, down: 0, degraded: 0, total: 0 },
    external: { up: 0, down: 0, degraded: 0, total: 0 },
  };
  for (const c of cards) {
    const cat = by_category[c.category];
    if (!cat) continue;
    cat.total++;
    if (c.status === "up") cat.up++;
    else if (c.status === "down") cat.down++;
    else if (c.status === "degraded") cat.degraded++;
  }

  const overall = rollupStatus(cards.map((c) => c.status));

  return {
    overall,
    totals,
    by_category,
    services: cards,
    active_incidents: activeIncidents.map((i) => toIncidentPublic(i, services, locale)),
    recent_incidents: recentIncidents.map((i) => toIncidentPublic(i, services, locale)),
    generated_at: new Date().toISOString(),
    canonical: "self-hosted",
  };
}

function toIncidentPublic(
  i: {
    id: string;
    service_id: string | null;
    severity: string;
    status: string;
    title_it: string;
    title_en: string;
    started_at: Date;
    resolved_at: Date | null;
    updates: { id: string; status: string; body_it: string; body_en: string; createdAt: Date }[];
  },
  services: { id: string; slug: string }[],
  locale: string
): IncidentPublic {
  const svc = services.find((s) => s.id === i.service_id);
  return {
    id: i.id,
    service_slug: svc?.slug ?? "unknown",
    severity: (i.severity ?? "minor") as IncidentPublic["severity"],
    status: (i.status ?? "investigating") as IncidentPublic["status"],
    title_it: i.title_it,
    title_en: i.title_en,
    started_at: i.started_at.toISOString(),
    resolved_at: i.resolved_at?.toISOString() ?? null,
    updates: i.updates.map((u) => ({
      id: u.id,
      status: (u.status ?? "investigating") as IncidentUpdatePublic["status"],
      message_it: u.body_it,
      message_en: u.body_en,
      created_at: u.createdAt.toISOString(),
    })),
  };
}

/**
 * 24h series for the spark-line chart per service. Returns at most 96
 * points (one per 15-minute bucket) so the payload stays small.
 */
export async function getServiceHistory(
  slug: string,
  hours: number = 24
): Promise<{ slug: string; points: { t: string; level: number; status: StatusLevel }[] } | null> {
  const svc = await prisma.statusService.findUnique({ where: { slug } });
  if (!svc) return null;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const snapshots = await prisma.statusSnapshot.findMany({
    where: { service_id: svc.id, taken_at: { gte: since } },
    orderBy: { taken_at: "asc" },
    select: { taken_at: true, status: true },
  });

  // Bucket into 15-min windows
  const BUCKET_MS = 15 * 60_000;
  const buckets = new Map<number, StatusLevel>();
  const bucketOrder: number[] = [];
  for (const s of snapshots) {
    const t = Math.floor(s.taken_at.getTime() / BUCKET_MS) * BUCKET_MS;
    if (!buckets.has(t)) bucketOrder.push(t);
    // Pick the worst status in the bucket
    const prev = buckets.get(t);
    buckets.set(t, worseOf(prev, s.status as StatusLevel));
  }

  const points = bucketOrder.map((t) => {
    const status = buckets.get(t) ?? "unknown";
    return {
      t: new Date(t).toISOString(),
      status,
      level: statusToNumber(status),
    };
  });

  return { slug, points };
}

function worseOf(a: StatusLevel | undefined, b: StatusLevel): StatusLevel {
  const order: StatusLevel[] = ["unknown", "up", "maintenance", "degraded", "down"];
  const ai = a ? order.indexOf(a) : -1;
  const bi = order.indexOf(b);
  return order[Math.max(ai, bi)] ?? "unknown";
}

function statusToNumber(s: StatusLevel): number {
  switch (s) {
    case "up": return 1;
    case "degraded": return 2;
    case "down": return 0;
    case "maintenance": return 3;
    case "unknown": return -1;
    default: return -1;
  }
}

/**
 * Compute 7d / 30d uptime percentage for a service by replaying its
 * StatusPeriod rows. Cheaper than scanning snapshots because each row
 * is "status stayed X for [started_at, ended_at]". For the still-open
 * period, we use the current time as the end.
 */
export async function getServiceUptime(
  slug: string,
  days: number
): Promise<{ slug: string; days: number; uptime_pct: number | null } | null> {
  const svc = await prisma.statusService.findUnique({ where: { slug } });
  if (!svc) return null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const periods = await prisma.statusPeriod.findMany({
    where: { service_id: svc.id, started_at: { gte: since } },
    orderBy: { started_at: "asc" },
  });

  if (periods.length === 0) {
    return { slug, days, uptime_pct: null };
  }

  let total = 0;
  let upMs = 0;
  const now = Date.now();
  for (const p of periods) {
    const start = p.started_at.getTime();
    const end = p.ended_at ? p.ended_at.getTime() : now;
    const clamped = Math.max(0, Math.min(end, now) - Math.max(start, since.getTime()));
    total += clamped;
    if (p.status === "up") upMs += clamped;
  }

  if (total === 0) return { slug, days, uptime_pct: null };
  return { slug, days, uptime_pct: Math.round((upMs / total) * 10000) / 100 };
}
