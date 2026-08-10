/**
 * scripts/uptimerobot-fix.js — One-shot script to fix all UptimeRobot
 * monitors for the WWF Crotone status page.
 *
 * The strategy:
 *  1. GET /monitors to see what's there
 *  2. For monitors that need a URL change OR successHttpResponseCodes change:
 *     PATCH the existing monitor
 *  3. For monitors that need a TYPE change (e.g. PORT → HTTP):
 *     - We can't PATCH the type, so we DELETE + recreate
 *     - First, record the new monitor ID so we can update the seed later
 *  4. After the fix, regenerate the seed-status.ts so the source_id
 *     columns match the new UR monitor IDs
 *
 * Usage:  UPTIMEROBOT_API_KEY=... node scripts/uptimerobot-fix.js
 */

const API_KEY = process.env.UPTIMEROBOT_API_KEY;
if (!API_KEY) {
  console.error("UPTIMEROBOT_API_KEY not set");
  process.exit(1);
}

const BASE = "https://api.uptimerobot.com/v3";

const TYPE_MAP = { HTTP: 1, KEYWORD: 2, PING: 3, PORT: 4 };

// slug → plan for the UR monitor
const FIXES = {
  "main-site": {
    url: "https://wwfcrotone.it/it",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "admin": {
    url: "https://admin.wwfcrotone.it/admin/login",
    success_codes: ["2xx", "3xx", "4xx"],
    type: "HTTP",
  },
  "api-health": {
    url: "https://wwfcrotone.it/api/health",
    success_codes: ["2xx"],
    type: "HTTP",
  },
  "email-routing": {
    url: "https://wwfcrotone.it",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "whatsapp": {
    url: "https://wa.me/393513945109",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
  },
  "openstreetmap": {
    url: "https://www.openstreetmap.org/export/embed.html",
    success_codes: ["2xx", "3xx"],
    type: "HTTP",
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
};

// slug → substring in the friendly name (the existing UR monitor name)
const SLUG_TO_NAME = {
  "main-site": "main site",
  "admin": "admin panel",
  "api-health": "api health",
  "email-routing": "email routing",
  "whatsapp": "whatsapp",
  "openstreetmap": "openstreetmap",
  "vps-ping": "vps host ping",
  "postgres": "postgresql",
  "redis": "redis",
  "https-port": "https port",
  "ssh-port": "ssh port",
  "cloudflare": "cloudflare root",
  "cloudflare-r2": "cloudflare r2",
  "aruba": "aruba",
  "github": "github api",
  "github-repo": "github repo",
  "sentry": "sentry",
  "brevo-smtp": "brevo smtp",
  "brevo-api": "brevo api",
  "groq": "groq",
  "upstash": "upstash",
  "plausible": "plausible",
  "instatus": "instatus",
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

  // Match each fix to an existing monitor (by friendly name substring)
  const renames = [];
  for (const [slug, fix] of Object.entries(FIXES)) {
    const nameMatch = SLUG_TO_NAME[slug] ?? slug;
    const monitor = monitors.find((m) => m.friendlyName.toLowerCase().includes(nameMatch));
    if (!monitor) {
      console.warn(`  ⚠ no monitor found for slug "${slug}" (looking for "${nameMatch}")`);
      continue;
    }

    const targetType = TYPE_MAP[fix.type];
    const typeChanged = targetType !== monitor.type;
    const urlChanged = monitor.url !== fix.url;
    const codesChanged = fix.success_codes &&
      JSON.stringify([...monitor.successHttpResponseCodes].sort()) !==
      JSON.stringify([...fix.success_codes].sort());

    const newName = fix.type === "HTTP" && fix.url.includes("wwfcrotone.it/api/health")
      ? `${slug.replace(/-/g, " ")} (HTTP probe)`
      : monitor.friendlyName;
    const nameChanged = newName !== monitor.friendlyName;

    if (!typeChanged && !urlChanged && !codesChanged && !nameChanged) {
      console.log(`  ✓ ${slug}: already correct (id=${monitor.id})`);
      continue;
    }

    // If only url/codes/name need to change, PATCH works.
    if (!typeChanged) {
      const patch = {};
      if (urlChanged) patch.url = fix.url;
      if (codesChanged) patch.successHttpResponseCodes = fix.success_codes;
      if (nameChanged) patch.friendlyName = newName;
      console.log(`  → ${slug} (id=${monitor.id}): PATCH ${JSON.stringify(patch)}`);
      await api("PATCH", `/monitors/${monitor.id}`, patch);
      console.log(`     OK`);
      continue;
    }

    // Type change: DELETE + recreate
    const oldId = monitor.id;
    console.log(`  ⟳ ${slug} (id=${oldId}): type change ${monitor.type} → ${targetType}`);
    console.log(`     Step 1: delete old monitor`);
    await api("DELETE", `/monitors/${oldId}`);
    await new Promise((r) => setTimeout(r, 3000)); // rate limit
    const create = {
      friendlyName: newName,
      url: fix.url,
      type: targetType,
      interval: 300,
      timeout: 30,
    };
    if (fix.success_codes) create.successHttpResponseCodes = fix.success_codes;
    if (fix.type === "PORT") {
      const port = parseInt(fix.url.split(":").pop() ?? "0", 10);
      if (!port) {
        console.warn(`     ⚠ can't parse port from ${fix.url}, skipping`);
        continue;
      }
      create.port = port;
    }
    console.log(`     Step 2: create new monitor type=${fix.type}`);
    const created = await api("POST", "/monitors", create);
    const newId = created.id ?? created.data?.id;
    console.log(`     ✓ new monitor id=${newId}`);
    // Update the OTHER slug's matching in case it picks the deleted ID
    remapId(oldId, newId);
    renames.push({ slug, oldId, newId });
    await new Promise((r) => setTimeout(r, 3000)); // rate limit
  }

  if (renames.length) {
    console.log("\n=== Monitor ID changes ===");
    for (const r of renames) {
      console.log(`  ${r.slug}: ${r.oldId} → ${r.newId}`);
    }
    console.log("\nUpdate src/lib/status.ts or seed-status.ts with the new IDs.");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
