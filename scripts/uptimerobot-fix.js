/**
 * scripts/uptimerobot-fix.js — One-shot script to fix all UptimeRobot
 * monitors for the WWF Crotone status page.
 *
 * What it does:
 *  1. Lists all monitors
 *  2. Updates each problem monitor with:
 *     - A URL that actually returns 2xx (or 4xx for "reachable but needs auth")
 *     - `successHttpResponseCodes` set to ["2xx", "3xx", "4xx"] (so a 401
 *       from an API is still "up")
 *     - Switches TCP port probes to HTTP probes against our own
 *       /api/health/* endpoints
 *
 * Usage:  UPTIMEROBOT_API_KEY=... node scripts/uptimerobot-fix.js
 *
 * Idempotent — re-running it just no-ops if the monitor is already
 * correct.
 */

const API_KEY = process.env.UPTIMEROBOT_API_KEY;
if (!API_KEY) {
  console.error("UPTIMEROBOT_API_KEY not set");
  process.exit(1);
}

const BASE = "https://api.uptimerobot.com/v3";

/**
 * Mapping from our StatusService slug → fix the UR monitor should have.
 * Each entry says:
 *   url: the URL to monitor (HTTP)
 *   success_codes: which HTTP codes count as "up"
 *   type: 'HTTP' (most monitors) or 'KEYWORD' (for /api/health)
 *   keyword: optional string to search for in the body (KEYWORD only)
 */
const FIXES = {
  "main-site": {
    url: "https://wwfcrotone.it/it",
    success_codes: ["2xx", "3xx"],
  },
  "admin": {
    url: "https://admin.wwfcrotone.it/admin/login",
    success_codes: ["2xx", "3xx"],
  },
  "api-health": {
    url: "https://wwfcrotone.it/api/health",
    success_codes: ["2xx"],
    type: "KEYWORD",
    keyword: "ok",
  },
  "email-routing": {
    url: "https://wwfcrotone.it",
    success_codes: ["2xx", "3xx"],
  },
  "whatsapp": {
    url: "https://wa.me/393513945109",
    success_codes: ["2xx", "3xx"],
  },
  "openstreetmap": {
    url: "https://www.openstreetmap.org/export/embed.html",
    success_codes: ["2xx", "3xx"],
  },
  "vps-ping": {
    url: "159.195.42.18",
    type: "PING",
  },
  "postgres": {
    url: "https://wwfcrotone.it/api/health/db",
    success_codes: ["2xx"],
    type: "HTTP",
  },
  "redis": {
    url: "https://wwfcrotone.it/api/health/redis",
    success_codes: ["2xx"],
    type: "HTTP",
  },
  "https-port": {
    url: "https://wwfcrotone.it",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "ssh-port": {
    url: "159.195.42.18:22",
    type: "PORT",
  },
  "cloudflare": {
    url: "https://www.cloudflare.com/cdn-cgi/trace",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "cloudflare-r2": {
    url: "https://72bc35b52b7b652c0b9a04a63b39ba3d.r2.cloudflarestorage.com",
    success_codes: ["2xx", "3xx", "4xx"],
    type: "HTTP",
  },
  "aruba": {
    url: "https://www.aruba.it",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "github": {
    url: "https://api.github.com/repos/EliseyRotar/wwf-crotone-website",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "github-repo": {
    url: "https://github.com/EliseyRotar/wwf-crotone-website",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "sentry": {
    // sentry.io root returns 302 → still reachable from CF
    url: "https://sentry.io/api/0/",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "brevo-smtp": {
    url: "https://api.brevo.com/v3/",
    success_codes: ["2xx", "3xx", "4xx"],
    type: "HTTP",
  },
  "brevo-api": {
    url: "https://api.brevo.com/v3/",
    success_codes: ["2xx", "3xx", "4xx"],
    type: "HTTP",
  },
  "groq": {
    url: "https://api.groq.com",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "upstash": {
    url: "https://api.upstash.com",
    success_codes: ["2xx", "3xx", "4xx"],
    type: "HTTP",
  },
  "plausible": {
    url: "https://plausible.io",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "instatus": {
    url: "https://wwf-crotone.instatus.com",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "uptimerobot": {
    // This is the "is UptimeRobot itself up" check — pull from
    // status.uptimerobot.com's public statuspage.
    url: "https://status.uptimerobot.com/api/v2/summary.json",
    success_codes: ["2xx"],
    type: "HTTP",
  },
};

const TYPE_MAP = { HTTP: 1, KEYWORD: 2, PING: 3, PORT: 4 };

// Slug → friendly-name substring match (the friendly name is what UR shows
// in the dashboard, so we match against that)
const SLUG_TO_NAME = {
  "main-site": "main site",
  "admin": "admin panel",
  "api-health": "api health endpoint",
  "email-routing": "email routing",
  "whatsapp": "whatsapp",
  "openstreetmap": "openstreetmap",
  "vps-ping": "vps host ping",
  "postgres": "postgresql tcp",
  "redis": "redis tcp",
  "https-port": "https port",
  "ssh-port": "ssh port",
  "cloudflare": "cloudflare root",
  "cloudflare-r2": "cloudflare r2",
  "aruba": "aruba",
  "github": "github api",
  "github-repo": "github repo",
  "sentry": "sentry ingest",
  "brevo-smtp": "brevo smtp",
  "brevo-api": "brevo api root",
  "groq": "groq api",
  "upstash": "upstash redis",
  "plausible": "plausible",
  "instatus": "instatus",
  "uptimerobot": "uptimerobot platform", // we don't actually have a UR monitor for this; skip
};

async function api(method, path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${method} ${path} → ${resp.status}: ${text}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : { success: true };
}

async function main() {
  const all = await api("GET", "/monitors");
  const monitors = all.data;
  console.log(`Found ${monitors.length} monitors`);

  // Match by friendly-name substring
  for (const [slug, fix] of Object.entries(FIXES)) {
    const nameMatch = SLUG_TO_NAME[slug] ?? slug;
    const monitor = monitors.find((m) => m.friendlyName.toLowerCase().includes(nameMatch));
    if (!monitor) {
      console.warn(`  ⚠ no monitor found for slug "${slug}" (looking for "${nameMatch}")`);
      continue;
    }

    const changes = {};
    const typeChanged = fix.type && TYPE_MAP[fix.type] !== monitor.type;
    if (monitor.url !== fix.url) changes.url = fix.url;
    if (typeChanged) {
      // UR doesn't allow type changes — we have to delete + recreate
      console.log(`  → ${slug} (id=${monitor.id}): type change required (${monitor.type} → ${TYPE_MAP[fix.type]})`);
      console.log(`     Step 1: delete old monitor`);
      await api("DELETE", `/monitors/${monitor.id}`);
      console.log(`     Step 2: create new monitor (type=${fix.type})`);
      const create = {
        friendlyName: monitor.friendlyName,
        url: fix.url,
        type: TYPE_MAP[fix.type],
        interval: 300,
        timeout: 30,
      };
      if (fix.success_codes) create.successHttpResponseCodes = fix.success_codes;
      if (fix.type === "KEYWORD" && fix.keyword) {
        create.keywordValue = fix.keyword;
        create.keywordType = 1;
      }
      if (fix.type === "PORT") {
        // PORT type needs port as a separate field, parsed from URL.
        const port = parseInt(fix.url.split(":").pop() ?? "0", 10);
        if (!port) {
          console.warn(`     ⚠ can't parse port from ${fix.url}, skipping`);
          continue;
        }
        create.port = port;
      }
      const created = await api("POST", "/monitors", create);
      // UR's POST response is the object directly (not wrapped in {data}),
      // unlike GET which returns {data: [...]}.
      const newId = created.id ?? created.data?.id;
      console.log(`     ✓ new monitor id=${newId}`);
      continue;
    }
    if (fix.success_codes) {
      const existing = (monitor.successHttpResponseCodes || []).join(",");
      const wanted = fix.success_codes.join(",");
      if (existing !== wanted) changes.successHttpResponseCodes = fix.success_codes;
    }
    if (fix.type === "KEYWORD" && fix.keyword && monitor.keywordValue !== fix.keyword) {
      changes.keywordValue = fix.keyword;
      changes.keywordType = 1; // 1 = contains
    }

    if (Object.keys(changes).length === 0) {
      console.log(`  ✓ ${slug}: already correct`);
      continue;
    }

    console.log(`  → ${slug} (id=${monitor.id}): ${JSON.stringify(changes)}`);
    await api("PATCH", `/monitors/${monitor.id}`, changes);
    console.log(`     OK`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
