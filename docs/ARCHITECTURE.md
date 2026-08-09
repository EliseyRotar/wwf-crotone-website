# WWF Crotone Volunteer Camps — Production Architecture

**Version:** 2.0 — lean budget
**Domain:** `wwfcrotone.it` (apex). `www.wwfcrotone.it` is a server alias that 301-redirects to the apex. `status.wwfcrotone.it` is a CNAME to Instatus (`wwfcrotone.instatus.com`). `admin.wwfcrotone.it` serves the Italian-only admin panel.
**Target launch:** Summer 2026 camp season (June 21)
**Hard budget cap:** €200/year TOTAL (VPS + domain + everything)

This document is the source of truth for how the site is deployed, why each piece was chosen, and how to provision it. It supersedes v1.0 (see git history) and reflects a reduced budget while preserving GDPR, security, and reliability.

---

## 1. Executive summary

A public volunteer registration site for 12 weekly camps, per-volunteer accounts, admin panel, IT/EN bilingual, GDPR-compliant — all for €200/year total. Roughly 5× cheaper than the original €940/yr stack. We gave up: Cloudflare Pro WAF custom rules, 1-min uptime checks, Sentry Team (multi-user, 90d retention), Grafana self-hosted, paid email at scale. We did **not** give up: GDPR, magic-link auth, AI chatbot, audit log, automated backups, EU data residency, PII scrubbing, rate limiting, or any security hardening. Every cut has a documented mitigation.

---

## 2. Goals & non-goals

**Goals**
- Public volunteer registration (12 weekly camps, June–Sept 2026)
- Per-volunteer account area (magic-link, editable booking, receipt upload, GDPR)
- Admin panel for bookings, receipts, gallery, blog
- Italian + English bilingual
- GDPR-compliant (EU residency, self-service export/delete, cookie consent)
- Total cost ≤ €200/yr
- Auditable, recoverable, observable enough for an NGO

**Non-goals (v1)**
- Multi-region failover
- Real-time volunteer chat
- Native mobile app
- WhatsApp Business API (wa.me link only)
- Online payments (bank transfer only)
- 24/7 staffed on-call (Instatus + email alerts)

---

## 3. The architecture in one picture

```
                                   ┌─────────────────────────────────┐
   Internet visitor ─── HTTPS ────► │   Cloudflare (Free plan)        │
                                   │   ─ DNS, CDN, SSL, DDoS (L3-7)  │
                                   │   ─ Email Routing (free)        │
                                   │   ─ R2 (free 10 GB)             │
                                   └────────────────┬────────────────┘
                                                    │  (CF-Connecting-IP)
                                                    ▼
                          ┌─────────────────────────────────────────┐
                          │  Netcup VPS 500 G12 (€5.50/mo promo)   │
                          │  4 vCPU · 8 GB RAM · 100 GB SSD · EU    │
                          │  ──────────────────────────────────── │
                          │  Docker Compose stack:                  │
                          │   ┌─────────────────────────────────┐   │
                          │   │ nginx (reverse proxy + TLS)     │◄──┼── CF Origin cert
                          │   └────────┬────────────────────────┘   │
                          │            ▼                             │
                          │   ┌─────────────────────────────────┐   │
                          │   │ app  (Next.js 15 standalone)    │   │
                          │   └────┬─────────────────────┬──────┘   │
                          │        │                     │          │
                          │        ▼                     ▼          │
                          │   ┌─────────┐          ┌─────────────┐   │
                          │   │ postgres│          │ walg-sidecar│   │
                          │   │  (16)   │◄─────────│  (backup)   │   │
                          │   └─────────┘          └──────┬──────┘   │
                          │   ┌─────────┐                  ▼          │
                          │   │ redis   │           ┌──────────┐     │
                          │   │(cache)  │           │ Cloudflare│     │
                          │   └─────────┘           │   R2     │     │
                          │                        │ (10 GB)  │     │
                          │   fail2ban + ufw +      └──────────┘     │
                          │   unattended-upgrades                    │
                          └─────────────────────────────────────────┘
                                                    │
                          ┌─────────────────────────┼─────────────────┐
                          ▼                         ▼                 ▼
                  ┌───────────────┐         ┌───────────────┐   ┌─────────────┐
                  │  Groq Cloud   │         │ Sentry.io     │   │ UptimeRobot │
                  │  (free)       │         │ Developer     │   │ (free, 5-mo │
                  │  llama-3.3    │         │ (free)        │   │  5-min int) │
                  └───────────────┘         └───────┬───────┘   └──────┬──────┘
                          ▲                         │                 │
                          │ chatbot tokens           │ 1 user, 5K/mo  │ 1 probe
                          │ server-side only         │ 30d retention  │
                          │                         │                ▼
                  ┌───────┴─────────────────────────┴───────┐  ┌─────────────┐
                  │  Outbound email: Brevo SMTP (free)      │  │  Instatus   │
                  │  300/day cap, Gmail SMTP fallback       │  │  (free)     │
                   │  [redacted-contact] existing inbox  │  │ status.*    │
                   └─────────────────────────────────────────┘  └─────────────┘
```

### 3.5 Domain at Aruba, nameservers pointed at Cloudflare

The `.it` apex (`wwfcrotone.it`) is **registered at Aruba.it**, not at Cloudflare Registrar. The reason is simple: **Cloudflare Registrar does not sell `.it` domains.** ICANN's registry for Italy is NIC.it (IT-NIC), and only a small number of accredited registrars can sell `.it` directly. Cloudflare used to act as a reseller via a partnership, but as of 2026 they no longer offer `.it` to new customers; their storefront explicitly hides `.it` from the search results. So even if you want everything else (DNS, CDN, DDoS, Email Routing, R2) on Cloudflare, you still have to buy the domain itself from a `.it`-accredited registrar.

**Why Aruba, specifically:**
- **Italian ICANN-accredited registrar** (one of the largest in Italy, parent company Aruba S.p.A., Arezzo). Handles the NIC.it registry interaction on our behalf.
- **EUC-compliant for `.it` rules:** `.it` requires either an EU-resident individual or an EU-registered organization (Codice Fiscale / P.IVA) at registration. WWF Italia ETS qualifies as an EU-registered org; we register under WWF Italia ETS's P.IVA with WWF Crotone as the local section. The registrant is the org, not a private individual.
- **WHOIS privacy** is included free (NIC.it does not expose personal data by default for `.it`; the public WHOIS shows only the registrar and the technical/admin contacts, which we set to a generic role address).
- **DNS hosting is decoupled from registration.** Aruba gives us a default DNS panel, but we do not use it: we change the nameservers (NS) to point at Cloudflare, and from that moment every DNS record (A, CNAME, MX, TXT, SPF, DMARC) is managed inside Cloudflare's dashboard. Aruba only acts as the billing/renewal entity.

**The €8/yr markup (vs Cloudflare at-cost):**
Cloudflare Registrar sells most TLDs at cost (no markup, ~€8/yr for a `.com`, etc.). Aruba charges the same registry fee for `.it` (NIC.it sets it; it has been ~€7-9/yr for years) but adds a small service fee and IVA (22% Italian VAT), landing at ~€8-12/yr total. The few euros of "markup" over a hypothetical at-cost option is the price of admission for being able to buy `.it` at all in 2026 — there is no cheaper path that doesn't require going through an `.it`-accredited registrar. We accept this as a fixed cost of doing business in Italy.

**Step-by-step provisioning (one-time, ~20 min):**

1. **Register at Aruba.it.** Go to `https://www.aruba.it` → "Domini" → "Registra dominio" → enter `wwfcrotone.it`. During checkout Aruba will:
   - Ask for the registrant's Codice Fiscale / P.IVA (use WWF Italia ETS's P.IVA — `02121111005` — and the legal address in Via Po 25/c, 00198 Roma).
   - Ask for an admin-c and tech-c contact email. Use a role address that forwards to `[redacted-contact]` (e.g. `admin@wwfcrotone.it` once Email Routing is set up, or `[redacted-contact]` in the meantime).
   - Collect ~€8-10 + IVA via carta / PayPal / bonifico.
   - Send a confirmation email to the admin-c with a link to verify the registration within 7 days (NIC.it requirement). Click it.
2. **Add the zone in Cloudflare.** Log into Cloudflare → "Add a site" → enter `wwfcrotone.it` → select the **Free plan**. Cloudflare will do a DNS scan and find no existing records (because nothing is using the domain yet). Click "Continue".
3. **Change nameservers at Aruba.** Cloudflare shows you two nameserver hostnames, e.g. `isla.ns.cloudflare.com` and `sid.ns.cloudflare.com` (exact names vary per assignment). Copy them. In the Aruba control panel go to `Pannello Domini` → click on `wwfcrotone.it` → `Gestione DNS` / `Nameserver` → "Usa nameserver personalizzati" / "Usa nameserver esterni" → paste the two Cloudflare hostnames → confirm. Aruba will propagate the NS change to NIC.it (usually instant, can take up to 24h).
4. **Wait for Cloudflare to detect the NS switch.** Back in Cloudflare, the status will change from "Pending" to "Active" once NIC.it confirms (typically 5-30 min after Aruba's change, but DNS TTL can extend this to a few hours). You will get an email from Cloudflare when it goes active.
5. **Add the DNS records from §7 below.** All A, CNAME, MX, TXT, SPF, DMARC records are created inside Cloudflare's DNS panel. Aruba's DNS panel is now irrelevant — leave it untouched (or, if Aruba complains, set its records to garbage; Cloudflare will always win because it owns the NS).
6. **Set up Email Routing in Cloudflare.** Once the zone is active: Cloudflare dashboard → `wwfcrotone.it` → `Email` → `Email Routing` → enable, verify the destination address (`[redacted-contact]`) by clicking the confirmation email Cloudflare sends to the existing inbox, then add the rules: `info@` → `[redacted-contact]` (forwarded), catch-all `*@` → `[redacted-contact]` (forwarded). The MX records shown in §7 are auto-created by Email Routing — do not edit them manually.
7. **Set up R2 bucket (if not done).** Cloudflare → R2 → Create bucket `wwf-backups` (EU region hint) → generate API token scoped to that bucket → paste into `infra/.env.production.example` (lines `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).
8. **Annual renewal.** Aruba will send a renewal email ~30 days before the `.it` expires (NIC.it does 1-year terms by default, multi-year is also an option). Pay it via Aruba's control panel. Cloudflare does not get involved in renewal because it does not own the domain.

**Why we don't move the registration to Cloudflare later:** even if Cloudflare re-enables `.it` someday, moving the registration would require a NIC.it transfer code, an auth code, ~2 weeks of DNS propagation, and a small fee — for no operational benefit, because all the operational DNS is already on Cloudflare's NS. The registrar matters only for billing and the legal registrant record; the NS controls everything else.

---

## 4. Stack & rationale

### 4.1 Frontend & runtime
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Already built. |
| Language | TypeScript (strict) | Already in place. |
| Styling | Tailwind 3 + CSS variables | Already in place. |
| i18n | next-intl | Already in place. |

### 4.2 Hosting — Netcup VPS 500 G12
| | |
|---|---|
| **Tier** | Cloud VPS 4 (promo, 24-mo commit) |
| **Spec** | 4 vCPU shared · 8 GB RAM · 100 GB NVMe · IPv4+IPv6 |
| **Traffic** | "Unlimited" (200 Mbps fair-use) |
| **Region** | EU (Germany) |
| **Cost** | ~€5.50/mo · ~€66/yr |
| **Why Contabo** | ~5× cheaper than Hetzner CCX23, EU residency, instant provisioning. Shared vCPU is fine — we are the only workload on the box. |

### 4.3 Edge — Cloudflare Free
| | |
|---|---|
| **What it gives us** | Global CDN, unmetered DDoS (L3-L7), Universal SSL, managed WAF ruleset, Email Routing, R2 (10 GB free), Registrar at-cost. |
| **What we gave up** | Custom WAF rules, advanced analytics, 24h email support. **Mitigation:** Nginx `limit_req` + per-route app rate limits + fail2ban cover abuse vectors. |
| **Why Free not Pro** | WAF custom rules are nice-to-have, not need-to-have. |

### 4.4 Domain — `wwfcrotone.it`
Registered at **Aruba.it** (Italian ICANN-accredited registrar — Cloudflare Registrar does not sell `.it`), nameservers pointed at Cloudflare Free so DNS, CDN, SSL, Email Routing, and R2 all live in Cloudflare. See §3.5 for the full step-by-step. Cost ~€8-12/yr (NIC.it registry fee + small Aruba service fee + 22% IVA). Registrant is WWF Italia ETS (P.IVA `02121111005`), local section WWF Crotone. `.it` requires an EU-registered org or EU-resident individual (Codice Fiscale or P.IVA at registration). Free WHOIS privacy (NIC.it does not expose personal data by default for `.it`). Apex `wwfcrotone.it` is canonical; `www.wwfcrotone.it` 301-redirects to it.

### 4.5 Database — Self-hosted Postgres 16
`postgres:16-alpine` in Docker, 30 GB on VPS SSD, WAL-G → Cloudflare R2. Self-hosted = cheapest + zero third-party data access (best for GDPR). Migrations run via `docker compose run migrate` on every deploy.

### 4.6 Cache + rate limiting — local Redis
Redis 7 in Docker, 128 MB cap, LRU eviction, no persistence (cache only). Sessions live in JWT-signed cookies (`jose`), not Redis — so cache loss on restart is harmless. We have 8 GB RAM to spare; no need for Upstash.

### 4.7 Email
| Address | Purpose | How |
|---|---|---|
| `[redacted-contact]` | Existing inbox, replies | Stays as-is |
| `[redacted-pec]` | Italian PEC | Stays as-is (separate provider) |
| Outbound transactional | Confirmations, magic links, admin alerts | **Brevo SMTP** (free, 300/day) · fallback Gmail SMTP |
| `info@…` | Public contact | CF Email Routing → Gmail |
| `noreply@…` | (Future) System mail | CF Email Routing → black hole |

**Why Brevo:** 300/day covers peak (June launch ≈ 130/day). The app's mailer transparently falls back to Gmail SMTP if Brevo's quota is hit.

### 4.8 WhatsApp
`wa.me/393513945109` link on `/contact` and `/account`. No Business API (Meta onboarding is too heavy for a volunteer NGO).

### 4.9 Error tracking — Sentry Developer (free)
5K errors/mo, 50K spans, 30d retention, 1 user. Mature Next.js integration, sourcemap support, beforeSend PII scrub already in `sentry.server.config.ts`. Only the admin gets alerts (via `[redacted-contact]`).

### 4.10 Monitoring — UptimeRobot + Instatus
| Tool | What |
|---|---|
| **UptimeRobot Free** | 5 HTTP/HTTPS probes, 5-min interval, email + webhook alerts on `*/api/health` |
| **Instatus Free** | Public status page (`wwfcrotone.instatus.com`, branded as `status.wwfcrotone.it` via Cloudflare CNAME). Components: Site, API, Database, Email. |

**Why no Prometheus/Grafana:** self-hosting on the same VPS wastes RAM and adds a stack to babysit. UptimeRobot + Instatus covers 95% of observability (uptime, public status, email alerts). Deep debugging via SSH + `docker stats` / `htop`.

### 4.11 Backups — WAL-G → Cloudflare R2
- **Tool:** WAL-G (continuous WAL archiver)
- **Dest:** R2 bucket `wwf-backups` (EU region hint)
- **Retention:** 30 days of WAL + 12 monthly base backups (auto-pruned)
- **Schedule:** Base backup nightly 03:00 UTC, WAL continuous
- **Restore drill:** Weekly Sunday 04:00 UTC — spin up throwaway Postgres, restore + integrity-check, email result to admin
- **Free-tier math:** R2 free = 10 GB storage, 1M Class A / 10M Class B ops/mo. Estimated usage: 2-3 GB, ~50K ops/mo. 5× headroom.

### 4.12 CI/CD — GitHub Actions
`push to main` → `npm ci` → typecheck/lint/test → `npm run build` → `docker build` → `docker save` → `rsync` to VPS → `docker compose up -d`. Rollback = `git revert && git push`. No separate registry (image is ~500 MB, rsync is fast on the VPS provider internal network).

---

## 5. Trade-offs we accepted (and how we mitigate them)

| What we cut | Why it hurts | Mitigation |
|---|---|---|
| **No CF WAF custom rules** | Can't block specific UAs / countries / paths at edge. | Nginx `limit_req` zones (general 30 r/s, api 10 r/s, auth 2 r/s) + per-route token buckets in `src/lib/rateLimit.ts` + fail2ban on SSH. CF's *managed* WAF ruleset still active. |
| **5-min uptime interval** (not 1-min) | 4-5 min of downtime could pass before alert. | Acceptable for a registration site, not a payment system. UptimeRobot fires email + webhook the moment the 5-min probe fails. |
| **Brevo free = 300/day** | Hard cap on transactional email. | 300/day is 3× expected peak (≈130/day at launch). Mailer falls back to Gmail SMTP (≤500/day). Magic-link requests rate-limited per email (1/60s, 10/day). |
| **R2 free = 10 GB** | Backups beyond 10 GB would fail or bill. | WAL-G retention = 30d + 12 monthly. Estimated 2-3 GB. Nightly `du` warning to admin if approaching limit. |
| **Sentry Dev = 1 user** | Only admin sees Sentry. | We don't need multi-user access. Errors route to a single Gmail inbox. |
| **Sentry Dev = 5K errors/mo, 30d** | Below old 50K cap, 30d history. | beforeSend drops 4xx noise + PII; real errors stay well under 5K/mo. 30d is enough to catch seasonal regressions. |
| **No Grafana** | No per-container CPU/mem/latency views. | UptimeRobot (up/down) + Instatus (public) covers the 95% case. SSH + `docker stats` for deep debugging. |
| **Contabo fair-use 200 Mbps** | Heavy traffic could be throttled. | CF CDN serves static assets; origin only sees dynamic. 50-100 concurrent users at peak won't hit 200 Mbps. |
| **No Redis persistence** | Cache loss on restart. | Cache is non-critical (DB is source of truth). Sessions are JWT-signed cookies. |

---

## 6. What we kept at full quality

These cost nothing extra to keep and are non-negotiable for an NGO handling personal data:

- **GDPR** — EU residency (Netcup (DE) + R2 EU), privacy policy, cookie consent, self-service data export, deletion request, DPIA-ready
- **TLS everywhere** — HSTS preload, TLS 1.2/1.3 only, CF Origin cert pinned in Nginx
- **CSP strict** — no `unsafe-inline` in prod (in `next.config.js`)
- **Magic-link auth** — jose-signed JWT, single-use tokens, 15-min expiry, bcrypt for any password fallback
- **PII scrubbing in Sentry** — `beforeSend` strips email, phone, fiscal code, PII regex matches
- **AI chatbot** — Groq Cloud free, llama-3.3, server-side only, system prompt restricted to WWF domain
- **Audit log** — every booking edit, magic-link request, admin action logged with actor + timestamp + before/after diff
- **Backups** — continuous WAL + nightly base, weekly restore drill with email report
- **File upload validation** — magic bytes (not MIME) for receipts
- **Rate limiting** — Nginx edge + per-route app
- **Firewall** — UFW (only 22/80/443), fail2ban on SSH, unattended-upgrades
- **IT/EN i18n** — full parity; admin panel Italian-only by design

---

## 7. DNS records

All managed in Cloudflare. Orange-cloud = proxied (CDN + DDoS). Grey-cloud = direct.

| Type | Name | Value | Proxy | Purpose |
|---|---|---|---|---|
| A | `@` | `<VPS_IP>` | ✅ | Main site |
| A | `www` | `<VPS_IP>` | ✅ | www redirect |
| A | `admin` | `<VPS_IP>` | ✅ | /admin (Italian-only) |
| CNAME | `status` | `wwfcrotone.instatus.com` | ✅ | Instatus status page |
| MX | `@` | `route1.mx.cloudflare.net` (prio 18) | n/a | CF Email Routing in |
| MX | `@` | `route2.mx.cloudflare.net` (prio 92) | n/a | CF Email Routing in backup |
| MX | `@` | `route3.mx.cloudflare.net` (prio 92) | n/a | CF Email Routing in backup |
| TXT | `@` | `v=spf1 include:_spf.brevo.com include:_spf.google.com ~all` | n/a | SPF (Brevo + Gmail) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:[redacted-contact]` | n/a | DMARC |
| TXT | `cf2024-1` | `<cloudflare-verification>` | n/a | CF domain verification (auto) |

**CF Email Routing rules:** `info@…` → `[redacted-contact]`; catch-all `*@…` → `[redacted-contact]`.

---

## 8. Server architecture

### 8.1 Filesystem layout (on VPS)

```
/srv/wwf/
├── docker-compose.yml          # Main stack
├── .env                        # Secrets (chmod 600, owned by deploy user)
├── nginx/conf.d/app.conf       # Reverse proxy
├── postgres/data/              # PG data dir
├── walg/env                    # WAL-G env (chmod 600)
├── backups/                    # Local copy of recent backups (last 7 days)
└── deploy/latest.tar.gz        # Last successful deploy bundle

/etc/
├── fail2ban/jail.local         # SSH brute-force protection
├── ufw/                        # Firewall rules
└── apt/20auto-upgrades         # Security-patch schedule

/var/log/wwf/                   # nginx + app logs
```

### 8.2 Docker Compose — main stack
Services: `app` (Next.js, port 3000), `migrate` (one-shot `prisma migrate deploy`), `postgres:16-alpine` (30 GB volume), `redis:7-alpine` (128 MB cap, no persistence), `nginx:1.27-alpine` (ports 80/443, CF Origin cert mounted).

Each service has `restart: unless-stopped` (except `migrate`), healthchecks, and a private `appnet` bridge network. Only Nginx publishes ports.

Full compose file: see `infra/docker-compose.yml` in the repo (kept in sync with this doc).

### 8.3 Nginx rate-limit zones (in `nginx.conf`)
```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=2r/s;
```
Applied per-location: `auth/magic-link` → `auth` (burst 5), `/api/*` → `api` (burst 20), everything else → `general` (burst 60). `set_real_ip_from` block includes all CF IP ranges; `real_ip_header CF-Connecting-IP;`. Security headers: HSTS preload, X-Frame-Options DENY, CSP via Next.js middleware, Permissions-Policy (no camera/mic/geo). `client_max_body_size 10M`.

### 8.4 Backups (WAL-G)
```ini
# /srv/wwf/walg/env
WALG_S3_PREFIX=s3://wwf-backups
AWS_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
AWS_REGION=auto
AWS_S3_FORCE_PATH_STYLE=true
WALG_COMPRESSION_METHOD=lz4
WALG_RETENTION_FULL=12            # 12 monthly base backups
WALG_RETENTION_DAYS=30            # 30 days of WAL

# crontab
0 3 * * *  docker exec postgres bash -c 'wal-g backup-push $PGDATA'
* * * * *  docker exec postgres bash -c 'wal-g wal-push $PGDATA/pg_wal'
0 4 * * 0  /srv/wwf/scripts/test-restore.sh
```

---

## 9. Pre-launch checklist

### 9.1 Credentials needed

**Cloudflare:** `CLOUDFLARE_API_TOKEN` (Zone Read/Edit, DNS Edit, Email Routing Edit), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

**Contabo:** `CONTABO_VPS_IP`, `CONTABO_SSH_PUBLIC_KEY`.

**Brevo (free):** `BREVO_SMTP_USER`, `BREVO_SMTP_PASS` (Settings → SMTP & API).

**Sentry (free):** `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

**UptimeRobot (free):** `UPTIMEROBOT_API_KEY` (optional, for webhook automation).

**Instatus (free):** no API key needed; just sign up and create the component page.

**App secrets (generated on VPS):** `AUTH_SECRET` (`openssl rand -base64 48`), `POSTGRES_PASSWORD` (`openssl rand -base64 32`).

**Existing (no change):** Gmail app password for fallback, `GROQ_API_KEY` (you have one).

### 9.2 Step-by-step provisioning

**Steps 1-6 (you, ~40 min total):** sign up & order.
1. **Aruba + Cloudflare** — register `wwfcrotone.it` at Aruba.it (under WWF Italia ETS's P.IVA `02121111005`, ~€8-12/yr), add the zone to Cloudflare on Free plan, change the nameservers at Aruba to the two Cloudflare NS records Cloudflare provides. From this moment on, every DNS record (A, CNAME, MX, TXT, SPF, DMARC) lives in Cloudflare's dashboard. See §3.5 for the full step-by-step.
2. **Contabo** — order Cloud VPS 4 (24-mo promo), EU (Germany), Ubuntu 24.04, your SSH key, name `wwf-prod-01`. Note the IPv4.
3. **Cloudflare R2** — create bucket `wwf-backups` (EU), generate API token scoped to that bucket.
4. **Brevo** — sign up free, Settings → SMTP & API → generate SMTP key.
5. **Sentry** — sign up free (Developer), create Next.js project, note DSN + auth token.
6. **UptimeRobot + Instatus** — add 5 health monitors, create 4-component status page (Site, API, Database, Email).

**Step 7 — VPS bootstrap (me, ~30 min after you provide SSH access).**
SSH in as root: apt update, install Docker + Compose plugin, UFW (only 22/80/443), fail2ban, unattended-upgrades, create `deploy` user, build `/srv/wwf/` tree, drop in `.env` / `docker-compose.yml` / Nginx / WAL-G env, `docker compose up -d`, install CF Origin cert, `prisma migrate deploy` + seed, smoke test.

**Step 8 — DNS + CF config (me, ~15 min).** All records in §7, Email Routing, R2 CORS if needed, UptimeRobot probes, Instatus webhook from UptimeRobot (auto-flip on probe failure).

**Step 9 — CI/CD (me, ~30 min).** Generate deploy SSH key (private on VPS, public in GitHub Actions), add `CONTABO_SSH_PRIVATE_KEY` / `CONTABO_VPS_IP` / `SENTRY_AUTH_TOKEN` to repo secrets, write `.github/workflows/deploy.yml`.

**Step 10 — Pre-launch audit (me, ~1 hour).** Security (CSP, headers, auth, rate limits), performance (Lighthouse, bundle), accessibility (axe-core, keyboard), GDPR (cookie consent, export, delete), smoke (booking flow, magic link, receipt, admin), trigger test Sentry error + test UptimeRobot "down" event, verify Brevo test email lands.

**Step 11 — Cutover (me, ~30 min).** TTL=300s 24h before, confirm NIC.it nameservers, wait for propagation, verify UptimeRobot + Instatus show operational, verify Brevo test email arrives.

---

## 10. Cost summary

| Item | Monthly | Yearly | Notes |
|---|---|---|---|
| Domain `wwfcrotone.it` (Aruba + NIC.it registry fee) | — | ~€10 | Italian VAT 22% included; €8-12/yr typical |
| Netcup VPS 500 G12 | €5.50 | €66 | 24-mo promo, EU |
| Cloudflare Free (DNS/CDN/SSL/DDoS/WAF-managed/Email Routing) | €0 | €0 | — |
| Cloudflare R2 free tier (10 GB) | €0 | €0 | Backups + ops |
| Brevo free tier (300/day SMTP) | €0 | €0 | — |
| Sentry Developer free (5K/mo, 1 user, 30d) | €0 | €0 | — |
| UptimeRobot free (5 monitors, 5-min) | €0 | €0 | — |
| Instatus free (public status page) | €0 | €0 | — |
| Groq Cloud free (chatbot) | €0 | €0 | Already in use |
| Gmail SMTP fallback (existing) | €0 | €0 | Already in use |
| wa.me link | €0 | €0 | — |
| **Subtotal** | **€5.50/mo** | **€74/yr** | |
| **Buffer** (overage, VAT, renewal spike, Brevo upgrade) | | **~€126/yr** | See §10.1 |
| **TOTAL CAP** | | **~€200/yr** | |

### 10.1 What the €126 buffer covers

The buffer is not waste — it's insurance:
- **VAT** (~€14/yr) — Contabo's €66 is ex-VAT; 22% Italian VAT on €66 = €14.52.
- **Domain renewal spike** (~€5/yr) — NIC.it occasionally adjusts .it pricing.
- **Brevo upgrade** (~€25/yr) — if peak season exceeds 300/day, one month of Brevo Starter (€25) covers it. Mitigation: rate-limit magic-link + Gmail fallback at 300/day.
- **Contabo renewal after promo** (~€80/yr) — if we lose the 24-mo rate, full-price ≈ €8/mo. Buffer covers one such year.
- **R2 overage** (~€0-1) — 10 GB headroom is 5× our 2-3 GB usage.
- **Sentry upgrade** (~€0) — if we hit 5K errors/mo, fix the bug causing them.
- **Incident response** (~€0) — buffer covers a few days of paid service if we ever need it (e.g., Sentry Pro for 7 days during a debugging crisis).

**Net:** €74/yr is the optimistic number. €200/yr is the realistic number including everything that could go up.

---

## 11. Capacity planning

| Metric | Current usage | Capacity | Headroom |
|---|---|---|---|
| Database size | ~50 MB | 30 GB on VPS | 600× |
| Disk | ~3 GB | 100 GB | 33× |
| RAM | ~2 GB | 8 GB | 4× |
| CPU (shared) | ~5% baseline, 25% peak | 4 vCPU | 20× / 4× |
| Bandwidth | ~10 GB/mo | CF + 200 Mbps fair-use | enough |
| Concurrent users | ~50 peak | thousands via Nginx | 20× |
| Brevo emails | ~80/day peak | 300/day | 3.75× |
| Sentry errors | <500/mo | 5,000/mo | 10× |
| R2 storage | ~2 GB | 10 GB | 5× |

Can handle **5-10× current load without scaling**. If exceeded, upgrade to Contabo Cloud VPS 6 (6 vCPU, 12 GB) for ~€7.50/mo.

---

## 12. Disaster recovery

| Scenario | RTO | RPO | How |
|---|---|---|---|
| App crash | <30s | 0 | `restart: unless-stopped` |
| VPS reboot | <2 min | 0 | Contabo auto-power-on |
| Postgres corruption | <1 hr | 0 | `wal-g backup-fetch` from R2 |
| Disk full | <30 min | 0 | Increase VPS volume in Contabo, redeploy |
| VPS lost | <4 hr | <16 MB WAL (≈1 min writes) | Re-provision VPS + restore from R2 |
| Contabo region down | <24 hr | <16 MB WAL | Provision new VPS elsewhere, restore from R2 |
| Cloudflare down | <5 min | 0 | Site unreachable but no data loss — CF caches most assets |
| R2 region down | <1 hr | 0 | R2 has multiple regions; we use EU. Restore retries with backoff. |
| Ransomware on VPS | <8 hr | <24h | Restore from R2 (separate credentials) |
| Sentry outage | <1 hr | 0 | Errors queue locally in Next.js, retry on reconnect |
| Brevo outage | <1 hr | 0 | Mailer transparently falls back to Gmail SMTP |
| UptimeRobot / Instatus outage | n/a | 0 | Find out via stale public URL — manual check |

---

## 13. Compliance checklist

**GDPR (EU):**
- EU data residency (Netcup (DE) + R2 EU)
- Privacy policy (`/privacy` + `/cookie`)
- Cookie consent banner
- Self-service data export (`/account/profile`)
- Self-service deletion request
- TLS everywhere (HSTS preload)
- CSP strict (no `unsafe-inline` in prod)
- PII scrubbing in Sentry (beforeSend hooks)
- Audit log for every booking edit
- DPIA — to be drafted before launch (contact DPO)

**Italian PEC:** `[redacted-pec]` maintained separately (out of scope).

**WCAG 2.1 AA:** keyboard nav, focus in chat widget, ARIA on icon buttons, skip-to-content, color contrast light+dark. ⏳ Manual screen reader test (NVDA + VoiceOver) before launch.

---

## 14. Migration path if budget increases

In priority order:

**Tier 1 — €300/yr (+€100 from baseline):**
1. **Contabo Cloud VPS 6** (+€24 → €90/yr) — 6 vCPU, 12 GB RAM
2. **Sentry Team** (~$26/mo ≈ €270 → €360/yr) — 50K errors, 90d, multi-user, 5M spans, 5 GB logs. Worth it the moment >1 person debugs.

**Tier 2 — €500/yr (+€400):**
3. **Cloudflare Pro** (~$20/mo ≈ €200 → €560/yr) — WAF custom rules, advanced analytics, 24h email support
4. **Brevo Starter** (€25/mo for peak month) — removes Gmail fallback dependency

**Tier 3 — €1000/yr (the original v1.0 budget):**
5. **Hetzner CCX23** (+€290 → €850/yr) — 16 GB RAM, dedicated vCPU, Hetzner reputation
6. **Dedicated Prometheus + Grafana** — bring back the in-house observability stack

**We will NOT migrate to:** AWS / GCP / Azure (overkill, 10× cost); Kubernetes / ECS (single-VPS Compose is the right complexity); managed Postgres (self-hosted is cheaper and more private).

---

## 15. Operational runbook

```bash
# Deploy
git push origin main    # GitHub Actions builds, tests, deploys

# Roll back
git revert HEAD && git push origin main
# or on VPS:
ssh deploy@<vps> && cd /srv/wwf && docker compose up -d --force-recreate app

# Logs
ssh deploy@<vps>
docker logs --tail 100 -f wwf-app-1
tail -f /var/log/wwf/nginx-access.log

# Manual DB backup
ssh deploy@<vps>
docker exec postgres bash -c 'wal-g backup-push $PGDATA'

# Restore from backup
ssh deploy@<vps>
cd /srv/wwf && docker compose stop app
docker exec postgres bash -c 'wal-g backup-fetch /tmp/restore'
docker exec postgres bash -c 'rm -rf $PGDATA && mv /tmp/restore $PGDATA'
docker compose start postgres app

# Rotate secrets
ssh deploy@<vps>
openssl rand -base64 48 > /srv/wwf/.env.new   # edit, then:
mv /srv/wwf/.env.new /srv/wwf/.env
cd /srv/wwf && docker compose up -d --force-recreate app

# Add admin user
ssh deploy@<vps>
docker exec -it wwf-app-1 npx tsx scripts/create-admin.ts --email paolo@wwf.it --role superadmin

# Switch SMTP to Gmail fallback
ssh deploy@<vps>    # edit .env: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true
cd /srv/wwf && docker compose up -d --force-recreate app
```

---

## 16. Open questions (before deployment)

1. **Contabo 24-month commit** — OK with the 24-mo promo commit, or prefer month-to-month (slightly more)?
2. **Geo-restrict /admin** — Italian/EU IPs only? Without CF WAF custom rules, this has to be done at Nginx level (country codes from CF header).
3. **Cookie banner analytics** — keep Plausible (privacy-first, no consent needed) or switch to GA4 (requires consent)?
4. **DPIA** — do you have a DPO or need help drafting one?
5. **WhatsApp number** — confirm `[redacted-phone]`?
6. **Pre-launch comms** — maintenance page during cutover?
7. **Backup retention** — 30d OK, or longer for compliance?
8. **Staging domain** — `staging.wwfcrotone.it` (free CNAME) to test deploys before going live?
9. **Instatus subdomain** — `status.wwfcrotone.it` (CNAME to `wwfcrotone.instatus.com`) or `wwfcrotone.instatus.com`?
10. **Sentry alert recipient** — confirm `[redacted-contact]` is the single Sentry user?

---

**End of architecture document. Next step: provision the accounts in §9.1, then paste credentials and I'll execute §9.2 steps 7-11.**
