# Setup & Deployment Guide

> For people who want to **run a copy of this site** — local dev, on-prem,
> or self-hosted. If you just want to **see what this project is**, read
> [`README.md`](../README.md) instead.

This guide covers four scenarios:

1. [Local development](#local-development) — running the site on your laptop
2. [Project structure](#project-structure) — what lives where
3. [Configuration](#configuration) — env vars and design tokens
4. [Production deployment](#production-deployment) — VPS bootstrap + CI/CD
5. [Operating it](#operating-it) — backups, monitoring, restore drills

For privacy / GDPR documentation see [`DPIA.md`](./DPIA.md).
For architecture decisions see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Local development

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone https://github.com/EliseyRotar/wwf-crotone-website.git
cd wwf-crotone-website
npm install

cp .env.example .env
# Edit .env with your values (see Configuration below)

npx prisma db push
npx prisma generate
npx tsx prisma/seed.ts           # 12 turns + gallery
npx tsx prisma/seed-campi-import.ts   # (optional) demo registrations
npx tsx prisma/seed-operatori    # (optional) demo operators

npm run dev
```

Visit <http://localhost:3000>.

### Admin access

The seed creates a superadmin account. **Change the password immediately
after first login.**

```
URL:      http://localhost:3000/admin/login
Email:    admin@wwfcrotone.it
Password: WWFcroton3_2026!
```

---

## Project structure

```
.
├── prisma/
│   ├── schema.prisma          # 18 models (User, Iscrizione, Turno, …)
│   ├── seed.ts                # 12 turns + gallery + superadmin
│   ├── seed-campi-2026.ts     # 2026 subscription data (typed)
│   └── seed-campi-import.ts   # idempotent re-import script
├── public/
│   ├── images/gallery/        # Camp photos (Wikimedia + WWF)
│   ├── logos/                 # WWF brand assets
│   ├── downloads/             # Brochure PDF
│   └── uploads/               # Admin-uploaded files (gitignored)
├── src/
│   ├── app/
│   │   ├── [locale]/          # Public site (IT/EN, server components)
│   │   │   ├── page.tsx       # Home
│   │   │   ├── about/         # Chi siamo
│   │   │   ├── activities/    # Attività
│   │   │   ├── dates/         # Date e Prenotazione
│   │   │   ├── gallery/       # Galleria
│   │   │   ├── faq/           # FAQ
│   │   │   ├── contact/       # Contatti
│   │   │   ├── blog/          # News
│   │   │   ├── account/       # Volunteer self-service (magic-link)
│   │   │   ├── privacy/       # Privacy + Cookie policy
│   │   │   ├── support/       # Patron / donor info
│   │   │   ├── packing-list/  # Cosa portare
│   │   │   ├── maintenance/   # 503 page
│   │   │   └── status/        # → Instatus
│   │   ├── admin/             # Admin panel (Italian only)
│   │   │   ├── login/         # Login (geo-restricted)
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── iscrizioni/    # Registrations CRUD
│   │   │   ├── operatori/     # Operators CRUD
│   │   │   ├── turni/         # Turn capacity config
│   │   │   ├── gallery/       # Photo/video upload
│   │   │   ├── roster/        # Per-turn roster view
│   │   │   ├── camp-settings/ # IBAN, dates, costs
│   │   │   ├── utenti/        # Admin user mgmt
│   │   │   ├── blog/          # Blog editor
│   │   │   └── audit/         # Audit log viewer
│   │   ├── api/               # API routes
│   │   │   ├── iscrizione/    # Public booking submission
│   │   │   ├── newsletter/    # Newsletter signup + unsubscribe
│   │   │   ├── chat/          # AI chatbot (SSE streaming)
│   │   │   ├── availability/  # Live turn counts (public)
│   │   │   ├── account/       # Magic-link self-service
│   │   │   ├── admin/         # Admin CRUD
│   │   │   ├── search/        # Site search
│   │   │   ├── blog/          # Blog API
│   │   │   ├── instagram/     # IG feed
│   │   │   └── health/        # Healthcheck
│   │   ├── sitemap.ts         # sitemap.xml
│   │   └── robots.ts          # robots.txt
│   ├── components/            # React components
│   │   ├── features/          # BookingForm, ChatWidget, …
│   │   ├── admin/             # Admin-only
│   │   ├── layout/            # Header, Footer, MobileMenu
│   │   └── ui/                # FaqAccordion, CookieBanner, …
│   ├── lib/                   # Utilities
│   │   ├── auth.ts            # JWT sessions + cookies
│   │   ├── prisma.ts          # Prisma client
│   │   ├── mail.ts            # Nodemailer wrapper (Brevo / Gmail)
│   │   ├── rateLimit.ts       # In-memory + Upstash token bucket
│   │   ├── chatGuard.ts       # Injection pre-flight + output scrub
│   │   ├── chatbot-knowledge.ts  # System prompt + brochure facts
│   │   └── …                  # Many more
│   ├── messages/              # i18n (it.json, en.json)
│   ├── i18n/                  # next-intl config
│   ├── config/                # site.ts, colors
│   ├── hooks/                 # React hooks
│   └── middleware.ts          # Locale routing + CSP nonce + maintenance
├── infra/
│   ├── docker-compose.yml     # app + postgres + redis + nginx
│   ├── nginx/                 # Configs + Dockerfile
│   ├── scripts/               # bootstrap, deploy, smoke, restore
│   └── .env.production.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DPIA.md                # GDPR Article 35 assessment
│   ├── SETUP.md               # this file
│   ├── BREVO_SETUP.md
│   ├── CLOUDFLARE_SETUP.md
│   ├── CLOUDFLARE_MANUAL_STEPS.md
│   ├── vps-provider-research-2026-08.md
│   └── screenshots/
├── .github/workflows/         # CI + deploy
├── next.config.js             # CSP headers, i18n plugin, standalone
├── tailwind.config.js         # WWF design tokens
└── prisma/schema.prisma       # 18 models
```

---

## Configuration

### Environment variables

Copy `.env.example` → `.env` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./dev.db` for SQLite, `postgresql://…` for prod |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 48`. App refuses to start if missing or placeholder. |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://wwfcrotone.it` in prod |
| `USE_BREVO_EMAIL` | optional | `true` to use Brevo SMTP, `false` for Gmail fallback |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` | ✅ if email | `smtp-relay.brevo.com:587` |
| `SMTP_USER` `SMTP_PASS` | ✅ if email | Brevo SMTP login + key |
| `BREVO_API_KEY` | optional | Brevo REST API (for non-SMTP operations) |
| `ADMIN_NOTIFY_EMAIL` | ✅ if email | Where booking notifications go |
| `GROQ_API_KEY` | optional | For chatbot. Free tier: https://console.groq.com/keys |
| `UPSTASH_REDIS_REST_URL` `_TOKEN` | optional | Distributed rate limiting. Falls back to in-memory if unset. |
| `TRUSTED_PROXY_HEADER` | prod | `cf-connecting-ip` when behind Cloudflare. Disables `X-Forwarded-For` trust. |
| `MAINTENANCE_MODE` | optional | `true` shows 503 to visitors |
| `SENTRY_DSN` | optional | Error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Client-side errors |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | optional | `wwfcrotone.it` for analytics |

For the full production env (`/srv/wwf/.env.production` on the VPS), also
see `infra/.env.production.example`.

### Design tokens

All colours come from CSS variables in `src/app/globals.css` and are
exposed through Tailwind tokens in `tailwind.config.js`. Dark mode is
auto-detected from system preference + overridable via the theme toggle.

| Token | Light | Dark |
|---|---|---|
| Brand green | `#007932` | `#007932` |
| CTA orange | `#eb9c4b` | `#eb9c4b` |
| Text | `#101010` | `#e8e6e3` |
| Surface | `#ffffff` | `#141413` |
| Sand (alt sections) | `#f6f2ed` | `#1a1a18` |
| Headings | Oswald, uppercase | |
| Body | Inter | |

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript checking |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:seed` | Seed 12 turns + gallery |
| `npm run db:studio` | Prisma Studio GUI |
| `npm test` | Vitest test suite (216 tests) |

---

## Production deployment

### Architecture in one paragraph

A single VPS (Netcup VPS 500 G12, DE — Debian 13 minimal, 2 vCPU, 4 GB
DDR5 ECC, 128 GB NVMe) runs the stack defined in
`infra/docker-compose.yml` — Next.js 15 standalone + Postgres 16 + Redis
7 + Nginx 1.27 + WAL-G. TLS is terminated at the Cloudflare edge, and the
Cloudflare→origin hop is encrypted with a **Cloudflare Origin certificate**
(15 years, pinned to `/etc/ssl/cloudflare/` on the VPS). DNS for
`wwfcrotone.it` is on Cloudflare; `status.wwfcrotone.it` is a CNAME to
Instatus.

### GitHub Actions — required secrets

Configure in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `VPS_SSH_KEY` | Private SSH key (Ed25519, no passphrase) authorized in `~/.ssh/authorized_keys` for the `deploy` user on the VPS. Deploy-only — no sudo, no shell beyond the docker compose commands. |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH user on the VPS |
| `SENTRY_AUTH_TOKEN` | Sentry personal/auth token with `project:releases` + `project:releases:write`. Optional — deploy skips Sentry step if empty. |
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `CLOUDFLARE_API_TOKEN` | DNS-only token (for managing DNS via API) |
| `BREVO_*` | SMTP credentials (for sending notifications) |
| `UPSTASH_*` | Redis REST URL + token |
| `R2_*` | Cloudflare R2 (S3-compatible backup storage) |
| `POSTGRES_PASSWORD` | DB password |
| `AUTH_SECRET` | Next.js auth secret |
| `GROQ_API_KEY` | Chatbot API key |
| `UPTIMEROBOT_API_KEY` | Uptime monitor API key |

The CI workflow (`.github/workflows/ci.yml`) runs `typecheck`, `lint`,
`test`, and `build` in parallel on every PR and push to `main`. The
`deploy` workflow is gated on CI green and on `workflow_run: workflows:
[CI], types: [completed], conclusion: success`.

### First-time VPS bootstrap (one-time, manual)

The `deploy` job assumes the VPS is already prepared. All of the
following is automated by **`infra/scripts/bootstrap-vps.sh`** — run it
once, as `root`, on a fresh Debian 13 VPS, then follow the printed
"next steps".

```bash
ssh root@<VPS_IP>
curl -fsSL https://raw.githubusercontent.com/EliseyRotar/wwf-crotone-website/main/infra/scripts/bootstrap-vps.sh -o /tmp/bootstrap-vps.sh
bash /tmp/bootstrap-vps.sh
```

The script is **idempotent** and performs, in order:

1. `apt update && apt -y upgrade` + base packages (ufw, fail2ban, unattended-upgrades, curl, git, jq…)
2. UFW firewall (22, 80, 443) + fail2ban
3. `unattended-upgrades` for security patches only
4. `deploy` user with NOPASSWD sudo + docker group
5. Docker Engine + Compose plugin
6. `/srv/wwf/{nginx,postgres,redis,assets,backups,scripts,walg,repo}` + `/var/log/wwf` + `/etc/ssl/cloudflare`
7. `git clone` of the repo into `/srv/wwf/repo`
8. `/etc/cron.d/wwf-backups` (nightly R2 base backup @ 03:00 UTC, WAL archive every minute, weekly restore drill Sunday 04:00 UTC)
9. Final summary with the public IP, SSH host-key fingerprint, and explicit next steps

### After the script finishes

| # | Action | Command |
|---|---|---|
| 1 | Authorize your (and GitHub Actions') SSH keys for `deploy` | `sudo -u deploy bash -c 'echo "ssh-ed25519 AAAA…" >> /home/deploy/.ssh/authorized_keys'` |
| 2 | Drop the Cloudflare **Origin** certificate (15y, `*.wwfcrotone.it` + `wwfcrotone.it`) into `/etc/ssl/cloudflare/{cert.pem,key.pem}` | `chmod 644 /etc/ssl/cloudflare/cert.pem && chmod 600 /etc/ssl/cloudflare/key.pem` |
| 3 | Fill the production env from the template | `sudo -u deploy cp /srv/wwf/.env.production.example /srv/wwf/.env.production && sudo -u deploy nano /srv/wwf/.env.production` |
| 4 | Bring the stack up | `cd /srv/wwf && sudo docker compose --project-name infra up -d --build` |
| 5 | Verify | `bash /srv/wwf/scripts/smoke-test.sh` then `bash /srv/wwf/scripts/post-deploy.sh` |
| 6 | Schedule the restore drill (already installed as a weekly cron) | `bash /srv/wwf/scripts/test-restore.sh` |

After this, every push to `main` that passes CI is deployed automatically.

### Helper scripts in `infra/scripts/`

| Script | Purpose | When |
|---|---|---|
| `bootstrap-vps.sh` | One-time VPS provisioning (OS, firewall, Docker, dirs, repo clone, cron) | Once, as `root` |
| `post-deploy.sh` | Post-deploy smoke + health summary. Exits non-zero on failure so CI `deploy` job fails loudly | After every GitHub Actions deploy |
| `test-restore.sh` | Pulls the latest WAL-G base backup from R2, restores into a throwaway Postgres, emails the result | Weekly (Sunday 04:00 UTC) via cron, or on-demand |
| `cloudflare-add-a-records.ps1` | Adds A records for apex + www once the VPS IP is known | One-time, when pointing DNS at a new VPS |

### Environment checklist for production

- [ ] `DATABASE_URL` points to PostgreSQL
- [ ] `AUTH_SECRET` generated with `openssl rand -base64 48`
- [ ] `SMTP_USER` / `SMTP_PASS` set (Brevo or Gmail app password)
- [ ] `GROQ_API_KEY` set if you want the chatbot
- [ ] `NEXT_PUBLIC_SITE_URL` set to your canonical domain
- [ ] `NODE_ENV=production`
- [ ] `TRUSTED_PROXY_HEADER=cf-connecting-ip` (if behind Cloudflare)
- [ ] Cloudflare Origin certificate installed at `/etc/ssl/cloudflare/`
- [ ] Branch protection on `main` requires the **CI / build** check before merge
- [ ] Change the superadmin password after first login

---

## Operating it

### Daily

- Smoke test on the live URL: `curl -fsS https://wwfcrotone.it/api/health`
  (expects `{"ok":true,"db":"ok"}`)

### Backups

- **Continuous WAL archive** to R2 (every minute, 7-day retention)
- **Nightly base backup** at 03:00 UTC (14-day retention)
- **Weekly restore drill** on Sunday 04:00 UTC — restores the latest
  base backup into a throwaway Postgres container and emails
  `wwfcrotone26@gmail.com` whether it succeeded.

### Monitoring (set up after first deploy)

- **Sentry** (`o4511881999679488.ingest.de.sentry.io`) — runtime errors.
  Source maps uploaded on every deploy via `deploy.yml`.
- **UptimeRobot** — 1+ monitors on `wwfcrotone.it`, `/api/health`,
  `/admin/login`. 5-minute interval.
- **Instatus** (`wwfcrotone.instatus.com`) — public status page. CNAME
  on `status.wwfcrotone.it`.
- **Cloudflare Analytics** — request volume, threats blocked.
- **Uptime log** — `sudo docker logs --tail 100 infra-app-1` on the VPS.

### Restarting services

```bash
# App only (after a code change, deploy.yml does this automatically)
ssh deploy@<VPS_IP> "cd /srv/wwf && sudo docker compose --project-name infra up -d --force-recreate --no-deps app"

# Full restart
ssh deploy@<VPS_IP> "cd /srv/wwf && sudo docker compose --project-name infra restart"

# Just nginx (config reload)
ssh deploy@<VPS_IP> "sudo docker exec infra-nginx-1 nginx -s reload"
```

### Maintenance mode

Flip `MAINTENANCE_MODE=true` in `/srv/wwf/.env.production`, then restart
the app container. The middleware shows a 503 page to all public traffic;
admin and API routes are exempt so you can keep working.

### GDPR / data handling

- Registration data lives in Postgres, never logged to Sentry
  (`beforeSend` hook strips PII for `/api/chat`, `/api/admin/*`,
  `/api/iscrizione`).
- Volunteers can request deletion via `/[locale]/account/gdpr-delete`
  or by emailing `wwfcrotone26@gmail.com`.
- The full DPIA is in [`DPIA.md`](./DPIA.md).

---

## Local Docker (smoke test only)

```bash
docker build -t wwf-crotone .
docker run -p 3000:3000 --env-file .env wwf-crotone
```

This runs the production build with SQLite (dev) for local validation.
The full Postgres + Redis + Nginx stack lives in `infra/docker-compose.yml`
and is intended for the VPS only.
