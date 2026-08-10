#!/usr/bin/env node
/**
 * scripts/status-poll.js — the status page data collector.
 *
 * Runs every 60s and:
 *  1. Fetches UptimeRobot getMonitors → StatusSnapshot rows for every
 *     StatusService where source = "uptimerobot" (matched by source_id)
 *  2. Fetches 8 public Atlassian-Statuspage summary.json endpoints
 *     (Cloudflare, GitHub, Sentry, Brevo, Upstash, UptimeRobot, Plausible, Groq)
 *     → StatusSnapshot + upserts any active incidents into our Incident table
 *  3. Self-probes /api/health + TCP pings to internal services
 *  4. For each service, computes the new StatusPeriod event if status changed
 *  5. Prunes StatusSnapshot to last 7 days
 *
 * Run as a separate Docker container (`docker compose up cron`) so it can
 * survive app container restarts. Single-instance only — no locking needed
 * because Postgres serializes the writes.
 *
 * Env: DATABASE_URL, UPTIMEROBOT_API_KEY, SELF_HEALTH_URL (optional,
 * default http://app:3000/api/health)
 *
 * Logging: stdout. Container logs are tailed by Docker.
 */

import { PrismaClient } from "@prisma/client";
import { setTimeout as wait } from "node:timers/promises";
import net from "node:net";

const prisma = new PrismaClient();

const UPTIMEROBOT_KEY = process.env.UPTIMEROBOT_API_KEY ?? "";
const SELF_HEALTH_URL = process.env.SELF_HEALTH_URL ?? "http://app:3000/api/health";
const POLL_INTERVAL_MS = 60_000;
const SNAPSHOT_TTL_DAYS = 7;

const STATUSPAGE_FEEDS = {
  "status.uptimerobot.com": {
    url: "https://status.uptimerobot.com/api/v2/summary.json",
    name_it: "UptimeRobot (piattaforma)",
    name_en: "UptimeRobot (platform)",
    category: "external",
    display_order: 90,
  },
};

const SELF_PROBES = [
  { slug: "postgres", host: "postgres", port: 5432 },
  { slug: "redis", host: "redis", port: 6379 },
];

function urStatusToOurs(s) {
  switch (s) {
    case 2: return "up";
    case 8: return "degraded";
    case 9: return "down";
    case 0: return "unknown";
    default: return "unknown";
  }
}

function statuspageIndicatorToOurs(indicator) {
  switch (indicator) {
    case "none": return "up";
    case "minor": return "degraded";
    case "major":
    case "critical": return "down";
    default: return "unknown";
  }
}

async function pollUptimeRobot() {
  if (!UPTIMEROBOT_KEY) return { matched: 0, snapshots: 0, errors: 0 };

  let monitors = [];
  try {
    const resp = await fetch("https://api.uptimerobot.com/v3/monitors", {
      headers: { Authorization: `Bearer ${UPTIMEROBOT_KEY}` },
    });
    if (!resp.ok) throw new Error(`UR fetch failed: ${resp.status}`);
    const data = await resp.json();
    monitors = data.data || [];
  } catch (e) {
    console.error(`[pollUptimeRobot] error:`, e.message);
    return { matched: 0, snapshots: 0, errors: 1 };
  }

  const services = await prisma.statusService.findMany({
    where: { source: "uptimerobot", active: true },
  });

  let snapshots = 0;
  let matched = 0;
  for (const svc of services) {
    if (!svc.source_id) continue;
    const monitorId = Number(svc.source_id);
    const m = monitors.find((x) => x.id === monitorId);
    if (!m) continue;
    matched++;
    const status = urStatusToOurs(m.status);
    const responseMs = m.average_response_time ? Number(m.average_response_time) : null;
    try {
      await prisma.statusSnapshot.create({
        data: {
          service_id: svc.id,
          status,
          response_ms: responseMs,
        },
      });
      snapshots++;
      await maybeUpdatePeriod(svc.id, status);
    } catch (e) {
      console.error(`[pollUptimeRobot] snapshot error for ${svc.slug}:`, e.message);
    }
  }

  return { matched, snapshots, errors: 0 };
}

async function pollStatuspageFeeds() {
  let totalSnaps = 0;
  let totalIncs = 0;
  let totalErrors = 0;

  for (const [host, def] of Object.entries(STATUSPAGE_FEEDS)) {
    const service = await prisma.statusService.findFirst({
      where: { source: "statuspage", source_id: host, active: true },
    });
    if (!service) continue;

    try {
      const resp = await fetch(def.url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`statuspage fetch failed: ${resp.status}`);
      const data = await resp.json();

      const overall = data.status?.indicator ?? (data.page?.status ?? "none");
      const status = statuspageIndicatorToOurs(overall);

      await prisma.statusSnapshot.create({
        data: { service_id: service.id, status, response_ms: null },
      });
      totalSnaps++;
      await maybeUpdatePeriod(service.id, status);

      for (const inc of data.incidents ?? []) {
        if (inc.status === "resolved") continue;
        const externalId = `${host}:${inc.id}`;
        await prisma.incident.upsert({
          where: { source_external_id: { source: "statuspage-feed", external_id: externalId } },
          create: {
            source: "statuspage-feed",
            external_id: externalId,
            service_id: service.id,
            severity: inc.impact === "critical" || inc.impact === "major" ? "major" : "minor",
            status: inc.status === "investigating" ? "investigating" : inc.status === "identified" ? "identified" : "monitoring",
            title_it: inc.name,
            title_en: inc.name,
            body_it: `Aggiornamento da ${data.page.name}: ${inc.name}`,
            body_en: `Update from ${data.page.name}: ${inc.name}`,
            started_at: new Date(inc.created_at),
            resolved_at: null,
          },
          update: {
            status: inc.status === "investigating" ? "investigating" : inc.status === "identified" ? "identified" : "monitoring",
            updatedAt: new Date(),
          },
        });
        totalIncs++;
      }
    } catch (e) {
      console.error(`[pollStatuspage] ${host} error:`, e.message);
      totalErrors++;
    }
  }

  return { feeds: Object.keys(STATUSPAGE_FEEDS).length, snapshots: totalSnaps, incidents: totalIncs, errors: totalErrors };
}

async function pollSelfProbes() {
  let snapshots = 0;
  let errors = 0;

  // /api/health
  const appSvc = await prisma.statusService.findUnique({ where: { slug: "api-health" } });
  if (appSvc) {
    const t0 = Date.now();
    try {
      const resp = await fetch(SELF_HEALTH_URL, {
        signal: AbortSignal.timeout(8_000),
      });
      const body = await resp.json().catch(() => null);
      const dbOk = body?.db === "ok" && body?.ok === true;
      const status = resp.status === 200 && dbOk ? "up" : resp.status === 200 ? "degraded" : "down";
      await prisma.statusSnapshot.create({
        data: { service_id: appSvc.id, status, response_ms: Date.now() - t0 },
      });
      snapshots++;
      await maybeUpdatePeriod(appSvc.id, status);
    } catch (e) {
      console.error(`[self-probe /api/health] error:`, e.message);
      errors++;
    }
  }

  // TCP probes (postgres, redis)
  for (const probe of SELF_PROBES) {
    const svc = await prisma.statusService.findUnique({ where: { slug: probe.slug } });
    if (!svc) continue;
    const t1 = Date.now();
    try {
      const connected = await new Promise((resolve) => {
        const sock = new net.Socket();
        const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 5_000);
        sock.once("connect", () => { clearTimeout(timer); sock.destroy(); resolve(true); });
        sock.once("error", () => { clearTimeout(timer); sock.destroy(); resolve(false); });
        sock.connect(probe.port, probe.host);
      });
      const status = connected ? "up" : "down";
      await prisma.statusSnapshot.create({
        data: { service_id: svc.id, status, response_ms: Date.now() - t1 },
      });
      snapshots++;
      await maybeUpdatePeriod(svc.id, status);
    } catch (e) {
      console.error(`[self-probe ${probe.slug}] error:`, e.message);
      errors++;
    }
  }

  return { snapshots, errors };
}

async function maybeUpdatePeriod(serviceId, newStatus) {
  const open = await prisma.statusPeriod.findFirst({
    where: { service_id: serviceId, ended_at: null },
    orderBy: { started_at: "desc" },
  });

  if (open && open.status === newStatus) return;
  if (open) {
    await prisma.statusPeriod.update({
      where: { id: open.id },
      data: { ended_at: new Date() },
    });
  }
  await prisma.statusPeriod.create({
    data: { service_id: serviceId, status: newStatus, started_at: new Date() },
  });
}

async function pruneOldSnapshots() {
  const cutoff = new Date(Date.now() - SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.statusSnapshot.deleteMany({
    where: { taken_at: { lt: cutoff } },
  });
  if (result.count > 0) console.log(`[prune] deleted ${result.count} old snapshots`);
}

async function tick() {
  const t0 = Date.now();
  console.log(`[${new Date().toISOString()}] tick starting`);

  const [ur, sp, sp_self] = await Promise.all([
    pollUptimeRobot(),
    pollStatuspageFeeds(),
    pollSelfProbes(),
  ]);

  await pruneOldSnapshots();

  const elapsed = Date.now() - t0;
  console.log(
    `[${new Date().toISOString()}] tick done in ${elapsed}ms: ` +
      `UR ${ur.matched}/${ur.snapshots} (${ur.errors} err), ` +
      `statuspage ${sp.snapshots} (${sp.incidents} incidents, ${sp.errors} err), ` +
      `self ${sp_self.snapshots} (${sp_self.errors} err)`
  );
}

async function main() {
  console.log("status-poll starting");
  console.log(`  poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`  snapshot TTL: ${SNAPSHOT_TTL_DAYS} days`);
  console.log(`  self health URL: ${SELF_HEALTH_URL}`);

  while (true) {
    try {
      await tick();
    } catch (e) {
      console.error("[main] tick failed:", e.message);
    }
    await wait(POLL_INTERVAL_MS);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
