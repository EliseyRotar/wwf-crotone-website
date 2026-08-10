/**
 * Seed the 24 StatusService rows that power status.wwfcrotone.it.
 *
 * Idempotent: re-runs are safe. Matches StatusService rows to existing
 * ones by slug and updates the source_id / name / category if they
 * drift; otherwise creates them.
 *
 * Reads UptimeRobot monitor IDs at runtime so source_id stays in sync
 * with the live UptimeRobot account.
 *
 * Run:  npx tsx prisma/seed-status.ts
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

type Monitor = {
  id: number;
  // UptimeRobot v3 returns the monitor name as `friendlyName`. The
  // `name` field is kept for back-compat with any older API consumer.
  friendlyName?: string;
  name?: string;
  type: string;
  url: string;
  status: number;
};

type ServiceSeed = {
  slug: string;
  name_it: string;
  name_en: string;
  category: "user-facing" | "infrastructure" | "external";
  display_order: number;
  source: "uptimerobot" | "statuspage" | "self-probe" | "instatus" | "manual";
  source_id?: string;
  url: string | null;
  description_it?: string;
  description_en?: string;
};

const services: ServiceSeed[] = [
  // === USER-FACING ===
  {
    slug: "main-site",
    name_it: "Sito principale",
    name_en: "Main site",
    category: "user-facing",
    display_order: 10,
    source: "uptimerobot",
    ur_name_pattern: /^Main site \(/,
    url: "https://wwfcrotone.it",
    description_it: "Sito pubblico wwfcrotone.it (landing, iscrizioni, FAQ, galleria, contatti).",
    description_en: "Public site wwfcrotone.it (landing, booking, FAQ, gallery, contact).",
  },
  {
    slug: "admin",
    name_it: "Pannello admin",
    name_en: "Admin panel",
    category: "user-facing",
    display_order: 11,
    source: "uptimerobot",
    ur_name_pattern: /^Admin panel/,
    url: "https://admin.wwfcrotone.it/admin/login",
    description_it: "Pannello di gestione interno (iscrizioni, turni, operatori, audit).",
    description_en: "Internal management panel (registrations, turns, operators, audit).",
  },
  {
    slug: "api-health",
    name_it: "API health",
    name_en: "API health",
    category: "user-facing",
    display_order: 12,
    source: "uptimerobot",
    ur_name_pattern: /^API health endpoint/,
    url: "https://wwfcrotone.it/api/health",
    description_it: "Endpoint /api/health — verifica del DB Postgres e risposta JSON.",
    description_en: "/api/health endpoint — Postgres check + JSON response.",
  },
  {
    slug: "email-routing",
    name_it: "Email routing",
    name_en: "Email routing",
    category: "user-facing",
    display_order: 13,
    source: "uptimerobot",
    ur_name_pattern: /^Email routing/,
    url: "https://wwfcrotone.it",
    description_it: "Catch-all info@wwfcrotone.it → wwfcrotone26@gmail.com (via Cloudflare Email Routing).",
    description_en: "Catch-all info@wwfcrotone.it → wwfcrotone26@gmail.com (via Cloudflare Email Routing).",
  },
  {
    slug: "whatsapp",
    name_it: "WhatsApp link",
    name_en: "WhatsApp link",
    category: "user-facing",
    display_order: 14,
    source: "uptimerobot",
    ur_name_pattern: /^WhatsApp/,
    url: "https://wa.me/393513945109",
  },
  {
    slug: "openstreetmap",
    name_it: "Mappa OpenStreetMap",
    name_en: "OpenStreetMap embed",
    category: "user-facing",
    display_order: 15,
    source: "uptimerobot",
    ur_name_pattern: /^OpenStreetMap/,
    url: "https://www.openstreetmap.org",
  },

  // === INFRASTRUCTURE (own VPS + Cloudflare) ===
  {
    slug: "vps-ping",
    name_it: "VPS (host)",
    name_en: "VPS host",
    category: "infrastructure",
    display_order: 20,
    source: "uptimerobot",
    ur_name_pattern: /^VPS host ping/,
    url: null,
    description_it: "Netcup VPS 500 G12 (Nuremberg) — ICMP ping 159.195.42.18.",
    description_en: "Netcup VPS 500 G12 (Nuremberg) — ICMP ping 159.195.42.18.",
  },
  {
    slug: "postgres",
    name_it: "PostgreSQL",
    name_en: "PostgreSQL",
    category: "infrastructure",
    display_order: 21,
    source: "uptimerobot",
    ur_name_pattern: /^PostgreSQL TCP/,
    url: null,
    description_it: "Database Postgres 16 (porta 5432, container Docker infra-postgres-1).",
    description_en: "Postgres 16 database (port 5432, Docker container infra-postgres-1).",
  },
  {
    slug: "redis",
    name_it: "Redis",
    name_en: "Redis",
    category: "infrastructure",
    display_order: 22,
    source: "uptimerobot",
    ur_name_pattern: /^Redis TCP/,
    url: null,
    description_it: "Cache Redis 7 (porta 6379) per rate limiting in-memory + sessioni.",
    description_en: "Redis 7 cache (port 6379) for in-memory rate limiting + sessions.",
  },
  {
    slug: "https-port",
    name_it: "HTTPS (port 443)",
    name_en: "HTTPS (port 443)",
    category: "infrastructure",
    display_order: 23,
    source: "uptimerobot",
    ur_name_pattern: /^HTTPS port/,
    url: null,
  },
  {
    slug: "ssh-port",
    name_it: "SSH (port 22)",
    name_en: "SSH (port 22)",
    category: "infrastructure",
    display_order: 24,
    source: "uptimerobot",
    ur_name_pattern: /^SSH port/,
    url: null,
  },
  {
    slug: "cloudflare",
    name_it: "Cloudflare",
    name_en: "Cloudflare",
    category: "infrastructure",
    display_order: 25,
    source: "uptimerobot",
    ur_name_pattern: /^Cloudflare root/,
    url: "https://cloudflare.com",
    description_it: "DNS, CDN, SSL, bot fight, email routing (free tier).",
    description_en: "DNS, CDN, SSL, bot fight, email routing (free tier).",
  },
  {
    slug: "cloudflare-r2",
    name_it: "Cloudflare R2",
    name_en: "Cloudflare R2",
    category: "infrastructure",
    display_order: 26,
    source: "uptimerobot",
    ur_name_pattern: /^Cloudflare R2/,
    url: null,
    description_it: "Bucket wwf-backups (storage backup WAL-G, 10 GB free tier).",
    description_en: "Bucket wwf-backups (WAL-G backup storage, 10 GB free tier).",
  },
  {
    slug: "aruba",
    name_it: "Aruba (registrar)",
    name_en: "Aruba (registrar)",
    category: "infrastructure",
    display_order: 27,
    source: "uptimerobot",
    ur_name_pattern: /^Aruba/,
    url: "https://admin.aruba.it",
    description_it: "Registrar del dominio .it (ordine MO21851180, scadenza 03/08/2028).",
    description_en: ".it domain registrar (order MO21851180, expiry 03/08/2028).",
  },

  // === EXTERNAL SERVICES ===
  {
    slug: "github",
    name_it: "GitHub",
    name_en: "GitHub",
    category: "external",
    display_order: 30,
    source: "uptimerobot",
    ur_name_pattern: /^GitHub API/,
    url: "https://github.com/EliseyRotar/wwf-crotone-website",
    description_it: "Repository, GitHub Actions CI/CD.",
    description_en: "Repository, GitHub Actions CI/CD.",
  },
  {
    slug: "github-repo",
    name_it: "GitHub repo (raggiungibile)",
    name_en: "GitHub repo (reachable)",
    category: "external",
    display_order: 31,
    source: "uptimerobot",
    ur_name_pattern: /^GitHub repo reachable/,
    url: "https://github.com/EliseyRotar/wwf-crotone-website",
  },
  {
    slug: "sentry",
    name_it: "Sentry",
    name_en: "Sentry",
    category: "external",
    display_order: 32,
    source: "uptimerobot",
    ur_name_pattern: /^Sentry ingest/,
    url: "https://sentry.io",
    description_it: "Error tracking (Sentry Developer free tier, 5k events/mo).",
    description_en: "Error tracking (Sentry Developer free tier, 5k events/mo).",
  },
  {
    slug: "brevo-smtp",
    name_it: "Brevo SMTP",
    name_en: "Brevo SMTP",
    category: "external",
    display_order: 33,
    source: "uptimerobot",
    ur_name_pattern: /^Brevo SMTP/,
    url: "https://www.brevo.com",
    description_it: "Invio email transazionali (SMTP relay free tier, 300/day).",
    description_en: "Transactional email (SMTP relay free tier, 300/day).",
  },
  {
    slug: "brevo-api",
    name_it: "Brevo API",
    name_en: "Brevo API",
    category: "external",
    display_order: 34,
    source: "uptimerobot",
    ur_name_pattern: /^Brevo API root/,
    url: "https://www.brevo.com",
  },
  {
    slug: "groq",
    name_it: "Groq (chatbot AI)",
    name_en: "Groq (AI chatbot)",
    category: "external",
    display_order: 35,
    source: "uptimerobot",
    ur_name_pattern: /^Groq API/,
    url: "https://groq.com",
    description_it: "LLM per chatbot (llama-3.3-70b-versatile, Groq free tier).",
    description_en: "LLM for chatbot (llama-3.3-70b-versatile, Groq free tier).",
  },
  {
    slug: "upstash",
    name_it: "Upstash Redis",
    name_en: "Upstash Redis",
    category: "external",
    display_order: 36,
    source: "uptimerobot",
    ur_name_pattern: /^Upstash Redis/,
    url: "https://upstash.com",
    description_it: "Rate limiting distribuito (free tier, 10k req/day).",
    description_en: "Distributed rate limiting (free tier, 10k req/day).",
  },
  {
    slug: "plausible",
    name_it: "Plausible Analytics",
    name_en: "Plausible Analytics",
    category: "external",
    display_order: 37,
    source: "uptimerobot",
    ur_name_pattern: /^Plausible/,
    url: "https://plausible.io",
    description_it: "Analytics privacy-first (no cookie banner required).",
    description_en: "Privacy-first analytics (no cookie banner required).",
  },
  {
    slug: "instatus",
    name_it: "Instatus (deprecato)",
    name_en: "Instatus (deprecated)",
    category: "external",
    display_order: 38,
    source: "uptimerobot",
    ur_name_pattern: /^Instatus/,
    url: "https://wwf-crotone.instatus.com",
    description_it: "Sarà dismesso quando status.wwfcrotone.it sarà pienamente operativo.",
    description_en: "Will be retired once status.wwfcrotone.it is fully operational.",
  },
  {
    slug: "uptimerobot",
    name_it: "UptimeRobot",
    name_en: "UptimeRobot",
    category: "external",
    display_order: 39,
    source: "statuspage",
    source_id: "status.uptimerobot.com", // matches STATUSPAGE_FEEDS key in status-poll.js
    ur_name_pattern: /NEVER_MATCHES/,
    url: "https://status.uptimerobot.com",
    description_it: "Piattaforma di monitoraggio (free tier, 50 monitor).",
    description_en: "Monitoring platform (free tier, 50 monitors).",
  },
];

async function main() {
  // Fetch live UptimeRobot monitors
  const urKey = process.env.UPTIMEROBOT_API_KEY;
  if (!urKey) throw new Error("UPTIMEROBOT_API_KEY not set");

  const urResp = await fetch("https://api.uptimerobot.com/v3/monitors", {
    headers: { Authorization: `Bearer ${urKey}` },
  });
  if (!urResp.ok) throw new Error(`UR fetch failed: ${urResp.status}`);
  const urData = (await urResp.json()) as { data: Monitor[] };
  const urById = new Map<number, Monitor>(urData.data.map((m) => [m.id, m]));
  // UptimeRobot v3 returns the monitor name as `friendlyName`, not `name`.
  const urByName = new Map<string, Monitor>(urData.data.map((m) => [m.friendlyName ?? m.name ?? "", m]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of services) {
    let urId: string | null = null;
    if (s.source === "uptimerobot") {
      // Find the monitor by name pattern
      for (const [name, m] of urByName) {
        if (s.ur_name_pattern.test(name)) {
          urId = String(m.id);
          break;
        }
      }
      if (!urId) {
        console.warn(`  ⚠ ${s.slug}: no UptimeRobot monitor matched pattern ${s.ur_name_pattern}`);
        skipped++;
        continue;
      }
    }

    const existing = await prisma.statusService.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.statusService.update({
        where: { slug: s.slug },
        data: {
          name_it: s.name_it,
          name_en: s.name_en,
          category: s.category,
          display_order: s.display_order,
          source: s.source,
          source_id: urId ?? s.source_id ?? null,
          url: s.url,
          description_it: s.description_it ?? null,
          description_en: s.description_en ?? null,
        },
      });
      updated++;
      console.log(`  ↻ ${s.slug}: updated`);
    } else {
      await prisma.statusService.create({
        data: {
          slug: s.slug,
          name_it: s.name_it,
          name_en: s.name_en,
          category: s.category,
          display_order: s.display_order,
          source: s.source,
          source_id: urId,
          url: s.url,
          description_it: s.description_it ?? null,
          description_en: s.description_en ?? null,
        },
      });
      created++;
      console.log(`  + ${s.slug}: created`);
    }
  }

  console.log(`\nResult: ${created} created, ${updated} updated, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());