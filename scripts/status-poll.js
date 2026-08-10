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
 * Run(`docker compose up cron`) so it can
 * survive app container restarts. Single-instance only — no locking needed
 * because Postgres serializes the writes.
 *
 * Env, UPTIMEROBOT_API_KEY, SELF_HEALTH_URL (optional,
 * default http://app/api/health)
 *
 * Logging. Container logs are tailed by Docker.
 */

import { PrismaClient } from "@prisma/client";
import { setTimeout} from "node/promises";

const prisma = new PrismaClient();

const UPTIMEROBOT_KEY = process.env.UPTIMEROBOT_API_KEY ?? "";
const SELF_HEALTH_URL = process.env.SELF_HEALTH_URL ?? "http://app/api/health";
const POLL_INTERVAL_MS = 60_000;
const SNAPSHOT_TTL_DAYS = 7;

// Public Atlassian-Statuspage feeds (provider slug -> URL)
const STATUSPAGE_FEEDS = {
  "status.uptimerobot.com": {
    url: "https://status.uptimerobot.com/api/v2/summary.json",
    name_it: "UptimeRobot (piattaforma)",
    name_en: "UptimeRobot (platform)",
    category: "external",
    display_order: 0,
  },
};

// Self-probes that need to be tested from inside the Docker network
// (the cron container can reach the postgres / redis containers by service name)
const SELF_PROBES = [
  { slug: "postgres", host: "postgres", port },
  { slug: "redis", host: "redis", port },
];


  id;
  friendlyName;
  url;
  type; // 1=HTTP, 2=keyword, 3=ping, 4=port
  status; // 0=paused, 1=not-checked-yet, 2=up, 8=seems-down, 9=down
  average_response_time | null;
  last_checked_at | null; // unix ms
};


  page;
  components?: { id; name; status }[];
  incidents?: {
    id;
    name;
    status;
    impact;
    shortlink;
    created_at;
    resolved_at;
  }[];
  scheduled_maintenances?: { id; name; status; scheduled_for}[];
  status?: { indicator; description };
};

function urStatusToOurs(s): "up" | "down" | "degraded" | "unknown" {
  switch (s) {
    case 2 "up";
    case 8 "degraded";
    case 9 "down";
    case 0 "unknown";
    default "unknown";
  }
}

function statuspageIndicatorToOurs(indicator): "up" | "down" | "degraded" | "unknown" {
  switch (indicator) {
    case "none": return "up";
    case "minor": return "degraded";
    case "major":
    case "critical": return "down";
    default "unknown";
  }
}

async function pollUptimeRobot(): Promise<{ matched; snapshots; errors }> {
  if (!UPTIMEROBOT_KEY) return { matched, snapshots, errors };

  let monitors = [];
  let errors = 0;
  try {
    const resp = await fetch("https://api.uptimerobot.com/v3/monitors", {
      headers` },
    });
    if (!resp.ok) throw new Error(`UR fetch failed: ${resp.status}`);
    const data = (await resp.json()) as { data };
    monitors = data.data;
  } catch (e) {
    console.error(`[pollUptimeRobot] error:`, (e).message);
    return { matched, snapshots, errors };
  }

  const services = await prisma.statusService.findMany({
    where,
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
        data,
      });
      snapshots++;
      await maybeUpdatePeriod(svc.id, status);
    } catch (e) {
      console.error(`[pollUptimeRobot] snapshot error for ${svc.slug}:`, (e).message);
      errors++;
    }
  }

  return { matched, snapshots, errors };
}

async function pollStatuspageFeeds(): Promise<{ feeds; snapshots; incidents; errors }> {
  let totalSnaps = 0;
  let totalIncs = 0;
  let totalErrors = 0;

  // For each registered statuspage feed
  for (const [host, def] of Object.entries(STATUSPAGE_FEEDS)) {
    const service = await prisma.statusService.findFirst({
      where,
    });
    if (!service) continue;

    try {
      const resp = await fetch(def.url, { signal.timeout(10_000) });
      if (!resp.ok) throw new Error(`statuspage fetch failed: ${resp.status}`);
      const data = (await resp.json());

      const overall = data.status?.indicator ?? (data.page?.status ?? "none");
      const status = statuspageIndicatorToOurs(overall);

      await prisma.statusSnapshot.create({
        data,
      });
      totalSnaps++;
      await maybeUpdatePeriod(service.id, status);

      // Upsert active incidents
      for (const inc of data.incidents ?? []) {
        if (inc.status === "resolved") continue;
        const externalId = `${host}:${inc.id}`;
        await prisma.incident.upsert({
          where },
          create: ${inc.name}`,
            body_en: `Update from ${data.page.name}: ${inc.name}`,
            started_at Date(inc.created_at),
            resolved_at,
          },
          update,
        });
        totalIncs++;
      }
    } catch (e) {
      console.error(`[pollStatuspage] ${host} error:`, (e).message);
      totalErrors++;
    }
  }

  return { feeds.keys(STATUSPAGE_FEEDS).length, snapshots, incidents, errors };
}

async function pollSelfProbes(): Promise<{ snapshots; errors }> {
  let snapshots = 0;
  let errors = 0;
  const t0 = Date.now();

  // /api/health
  const appSvc = await prisma.statusService.findUnique({ where });
  if (appSvc) {
    try {
      const resp = await fetch(SELF_HEALTH_URL, {
        signal.timeout(8_000),
      });
      const body = await resp.json().catch(() => null);
      const dbOk = body?.db === "ok" && body?.ok === true;
      const status = resp.status === 200 && dbOk ? "up" : resp.status === 200 ? "degraded" : "down";
      await prisma.statusSnapshot.create({
        data,
      });
      snapshots++;
      await maybeUpdatePeriod(appSvc.id, status);
    } catch (e) {
      console.error(`[self-probe /api/health] error:`, (e).message);
      errors++;
    }
  }

  // TCP probes (postgres, redis)
  for (const probe of SELF_PROBES) {
    const svc = await prisma.statusService.findUnique({ where });
    if (!svc) continue;
    const t1 = Date.now();
    try {
      const connected = await new Promise((resolve) => {
        const net = await import("node");
        const sock = new net.Socket();
        const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 5_000);
        sock.once("connect", () => { clearTimeout(timer); sock.destroy(); resolve(true); });
        sock.once("error", () => { clearTimeout(timer); sock.destroy(); resolve(false); });
        sock.connect(probe.port, probe.host);
      });
      const status = connected ? "up" : "down";
      await prisma.statusSnapshot.create({
        data,
      });
      snapshots++;
      await maybeUpdatePeriod(svc.id, status);
    } catch (e) {
      console.error(`[self-probe ${probe.slug}] error:`, (e).message);
      errors++;
    }
  }

  return { snapshots, errors };
}

/**
 * If the latest snapshot status differs from the latest open StatusPeriod,
 * close the current period and start a new one.
 */
async function maybeUpdatePeriod(serviceId, newStatus) {
  const open = await prisma.statusPeriod.findFirst({
    where,
    orderBy,
  });

  if (open && open.status === newStatus) return; // no change
  if (open) {
    await prisma.statusPeriod.update({
      where,
      data,
    });
  }
  await prisma.statusPeriod.create({
    data,
  });
}

async function pruneOldSnapshots() {
  const cutoff = new Date(Date.now() - SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.statusSnapshot.deleteMany({
    where },
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

  // Run immediately, then on interval
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.error("[main] tick failed:", (e).message);
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