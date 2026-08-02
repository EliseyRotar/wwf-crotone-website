# WWF Crotone Volunteer Camps — Production Architecture

**Version:** 1.0 — pre-launch
**Domain:** `wwfprovinciadicrotone.it`
**Target launch:** Summer 2026 camp season (June 21)

This document is the source of truth for how the site is deployed, why each piece was chosen, and exactly how to provision it.

---

## 1. Goals & non-goals

**Goals**
- Public volunteer registration site (12 weekly camps June–September 2026)
- Per-volunteer account area (magic-link login, editable booking, receipt upload, GDPR)
- Admin panel for managing bookings, receipts, gallery, blog
- Italian + English bilingual
- GDPR-compliant (EU data residency, self-service export/delete, cookie consent)
- Cheap enough for an NGO but reliable enough that registrations don't drop during peak weeks
- Auditable, recoverable, observable

**Non-goals (for v1)**
- Multi-region failover
- Real-time chat between volunteers
- Native mobile app
- WhatsApp Business API (wa.me link is the v1 contact channel)
- Stripe / online payments (bank transfer only for v1)

---

## 2. The architecture in one picture

```
                                   ┌─────────────────────────────────┐
   Internet visitor ─── HTTPS ────► │   Cloudflare (Pro, edge proxy)  │
                                   │   ─ DNS, CDN, WAF, DDoS, SSL   │
                                   │   ─ Email Routing               │
                                   │   ─ Access (Grafana + admin)   │
                                   └────────────────┬────────────────┘
                                                    │  (CF-Connecting-IP = real IP)
                                                    ▼
                          ┌─────────────────────────────────────────┐
                          │  Hetzner Falkenstein (CCX23, €29.90/mo) │
                          │  ──────────────────────────────────── │
                          │  Docker Compose stack:                  │
                          │   ┌─────────────────────────────────┐   │
                          │   │ nginx (reverse proxy + TLS)     │◄──┼─── CF Universal SSL terminates here
                          │   └────────┬────────────────────────┘   │
                          │            ▼                             │
                          │   ┌─────────────────────────────────┐   │
                          │   │ app  (Next.js 15 standalone)    │   │
                          │   │  — Port 3000                    │   │
                          │   │  — Build: npm run build && start│   │
                          │   │  — Health: /api/health          │   │
                          │   └────┬─────────────────────┬──────┘   │
                          │        │                     │          │
                          │        ▼                     ▼          │
                          │   ┌─────────┐          ┌─────────────┐   │
                          │   │ postgres│          │ walg-sidecar│   │
                          │   │  (16)   │◄─────────│  (backup)   │   │
                          │   └─────────┘          └──────┬──────┘   │
                          │                               │          │
                          │   ┌─────────┐                  ▼          │
                          │   │ redis   │           ┌──────────┐     │
                          │   │ (cache  │           │Backblaze │     │
                          │   │  only)  │           │   B2     │     │
                          │   └─────────┘           │wwf-backups    │
                          │                        └──────────┘     │
                          │                                          │
                          │   ┌─────────────────────────────────┐   │
                          │   │ prometheus  (scrapes /metrics)  │   │
                          │   │ grafana     (admin dashboards)  │◄──┼─── Behind Cloudflare Access
                          │   │ node-exporter                    │   │
                          │   └─────────────────────────────────┘   │
                          │                                          │
                          │   ┌─────────────────────────────────┐   │
                          │   │ fail2ban + ufw (host firewall)  │   │
                          │   │ unattended-upgrades (Ubuntu)    │   │
                          │   └─────────────────────────────────┘   │
                          └─────────────────────────────────────────┘
                                                    │
                          ┌─────────────────────────┼─────────────────┐
                          ▼                         ▼                 ▼
                  ┌───────────────┐         ┌───────────────┐   ┌─────────────┐
                  │  Groq Cloud   │         │ Sentry.io     │   │ Upstash     │
                  │  (free tier)  │         │ (Team $26/mo) │   │ Redis free  │
                  │  llama-3.3    │         │  + sourcemaps │   │ tier        │
                  └───────────────┘         └───────────────┘   └─────────────┘
                          ▲                         ▲
                          │ chatbot tokens           │ server + client errors
                          │ (server-side only)       │ (scrubbed for PII)
                          │                         │
                  ┌───────┴─────────────────────────┴───────┐
                  │  Outbound email: Gmail SMTP             │
                  │  (wwfcrotone26@gmail.com → volunteers)   │
                  └─────────────────────────────────────────┘
```

---

## 3. Stack & rationale

### 3.1 Frontend & runtime
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Already built. Server components + RSC + edge middleware. |
| Language | TypeScript (strict) | Already in place. |
| Styling | Tailwind 3 + CSS variables | Already in place. |
| i18n | next-intl | Already in place. |

### 3.2 Hosting — Hetzner Cloud
| | |
|---|---|
| **Tier** | CCX23 (Dedicated vCPU) |
| **vCPU** | 4 (AMD) |
| **RAM** | 16 GB |
| **SSD** | 160 GB |
| **Region** | Falkenstein, Germany (`fsn1`) |
| **Cost** | €29.90/mo |
| **Why Hetzner** | EU data residency (GDPR), 5× cheaper than AWS/GCP equivalent, excellent network, instant provisioning |
| **Why CCX23** | Generous headroom for Postgres + Next.js + Redis + Prometheus + Grafana + WAL-G sidecar all on one box. CCX23 dedicated vCPU avoids noisy-neighbour issues. |

### 3.3 Edge — Cloudflare Pro
| | |
|---|---|
| **Plan** | Pro ($20/mo) |
| **What it gives us** | Global CDN (300+ POPs), WAF, unmetered DDoS protection (L3/L4/L7), Universal SSL, advanced analytics, Email Routing (free), Access (free up to 50 users), Registrar (at-cost) |
| **Why Pro not Free** | WAF custom rules + 24h email support + rate-limit rules. Free tier's WAF is too limited. |

### 3.4 Domain — `wwfprovinciadicrotone.it`
| | |
|---|---|
| **Registrar** | Cloudflare Registrar |
| **Cost** | At-cost (~€10-15/yr, NIC.it registry fee) |
| **Why Cloudflare Registrar** | At-cost pricing, free WHOIS privacy, instant DNS propagation, no markup |
| **Requirement** | .it requires EU-resident individual or EU-registered organization. Provide your Codice Fiscale or VAT ID at registration. |

### 3.5 Database — Self-hosted Postgres 16
| | |
|---|---|
| **Engine** | PostgreSQL 16 (Docker image: `postgres:16-alpine`) |
| **Storage** | 20 GB on VPS SSD (volume mount: `/srv/wwf/postgres`) |
| **Backups** | WAL-G → Backblaze B2 (continuous WAL + nightly base backup) |
| **Why self-hosted** | Cheapest for this size. Supabase free tier would also work, but self-hosted gives full control + zero third-party data access (best for GDPR). |
| **Migration** | `prisma migrate deploy` runs as a one-shot on every deploy via `docker compose run migrate` |

### 3.6 Rate limiting — Upstash Redis free tier
| | |
|---|---|
| **Tier** | Free (10K commands/day, 1 database, 256 MB) |
| **What it's for** | Distributed rate limiter (replaces in-memory when running multi-instance in future) |
| **Why Upstash** | Zero ops, free, HTTP API (works with edge), GDPR-compliant (EU region available) |

### 3.7 Email
| Address | Purpose | How |
|---|---|---|
| `wwfcrotone26@gmail.com` | Existing inbox, all replies | Stays as-is |
| `wwfcrotone@legalmail.it` | Legal PEC (Italian certified email) | Stays as-is (separate provider) |
| **Outbound** transactional | Booking confirmations, magic links, admin notifications | Gmail SMTP via `wwfcrotone26@gmail.com` (current setup) |
| `info@wwfprovinciadicrotone.it` | Public-facing contact | Cloudflare Email Routing → forwards to `wwfcrotone26@gmail.com` |
| `noreply@wwfprovinciadicrotone.it` | (Future) System emails | Cloudflare Email Routing → drops to black hole |

**Note on Gmail SMTP:** works for low volume (≤500 emails/day). When you exceed 500/day, switch to Resend (free 100/day, $20/mo for 50K) or Amazon SES ($0.10 per 1K).

### 3.8 WhatsApp
| | |
|---|---|
| **Channel** | `wa.me/393513945109` (link only, no API) |
| **Where** | `/contact` page + `/account` dashboard footer |
| **Why no Business API** | Meta onboarding takes ~2 weeks and requires business documents. wa.me link is instant and free. |

### 3.9 Error tracking — Sentry Team
| | |
|---|---|
| **Plan** | Team ($26/mo) |
| **Errors** | 50K/month included |
| **Spans** | 5M/month |
| **Logs** | 5 GB/month |
| **Retention** | 90 days |
| **Why Sentry** | Industry standard, mature Next.js integration, sourcemap support, beforeSend hooks already wired in `sentry.server.config.ts` to scrub PII |

### 3.10 Monitoring — Prometheus + Grafana
| | |
|---|---|
| **Prometheus** | Self-hosted in Docker, scrapes `/metrics` endpoints (app + nginx + node-exporter) |
| **Grafana** | Self-hosted in Docker, behind Cloudflare Access |
| **URL** | `status.wwfprovinciadicrotone.it` |
| **Auth** | Cloudflare Access email OTP (free, ≤50 users) |
| **Dashboards** | App latency, DB connections, Redis ops, container CPU/mem, Nginx req/s, 4xx/5xx rate, disk usage |

### 3.11 Backups — WAL-G → Backblaze B2
| | |
|---|---|
| **Tool** | WAL-G (Postgres continuous WAL archiver) |
| **Destination** | Backblaze B2 bucket `wwf-backups` (EU region) |
| **Retention** | 30 days of continuous WAL + 12 monthly base backups |
| **Schedule** | Base backup: nightly at 03:00 UTC. WAL: continuous (every ~16 MB or 60s). |
| **Restore drill** | Weekly cron at Sunday 04:00 UTC: spins up a throwaway Postgres container, restores latest backup, runs integrity check, emails result to admin. |

### 3.12 CI/CD — GitHub Actions
| | |
|---|---|
| **Trigger** | Push to `main` |
| **Pipeline** | `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` → `docker build` → `docker save` → `rsync` to VPS → `docker compose up -d` |
| **Rollback** | `git revert && git push` (last good image is kept on VPS for 7 days) |
| **Why not GHCR** | Simpler — no separate registry. Image size is ~500 MB, rsync takes 5s on a Hetzner internal network. |

---

## 4. DNS records

All managed in Cloudflare. Orange-cloud = proxied through CF (DDoS protection, CDN). Grey-cloud = direct.

| Type | Name | Value | Proxy | Purpose |
|---|---|---|---|---|
| A | `@` | `<VPS_IP>` | ✅ | Main site |
| A | `www` | `<VPS_IP>` | ✅ | www redirect |
| A | `admin` | `<VPS_IP>` | ✅ | /admin (Italian-only) |
| A | `status` | `<VPS_IP>` | ❌ | Grafana (only reachable behind CF Access) |
| A | `cdn` | `<VPS_IP>` | ✅ | Static assets subdomain (future use) |
| MX | `@` | `route1.mx.cloudflare.net` (priority 18) | n/a | Cloudflare Email Routing inbound |
| MX | `@` | `route2.mx.cloudflare.net` (priority 92) | n/a | Cloudflare Email Routing inbound backup |
| MX | `@` | `route3.mx.cloudflare.net` (priority 92) | n/a | Cloudflare Email Routing inbound backup |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | n/a | SPF (allow Gmail to send as this domain) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:wwfcrotone26@gmail.com` | n/a | DMARC policy |
| TXT | `cf2024-1` | `<cloudflare-verification>` | n/a | Cloudflare domain verification (auto-added) |

**Cloudflare Email Routing rules** (set up in CF dashboard after domain added):
- `info@wwfprovinciadicrotone.it` → `wwfcrotone26@gmail.com` (catch-all to your inbox)
- `*@wwfprovinciadicrotone.it` (catch-all) → `wwfcrotone26@gmail.com`

---

## 5. Server architecture

### 5.1 Filesystem layout (on VPS)

```
/srv/wwf/
├── docker-compose.yml          # Main stack
├── docker-compose.monitoring.yml  # Prometheus + Grafana (separate so monitor can survive app restart)
├── .env                        # Secrets (chmod 600, owned by deploy user)
├── nginx/
│   ├── nginx.conf              # Reverse proxy config
│   └── conf.d/
│       ├── app.conf            # Site config
│       └── grafana.conf        # Grafana subdomain
├── postgres/
│   └── data/                   # PG data dir (mounted into container)
├── walg/
│   └── env                     # WAL-G env vars (chmod 600)
├── backups/                    # Local copy of recent backups (last 7 days)
├── letsencrypt/                # Backup of Cloudflare Origin cert (we use CF Universal SSL)
└── deploy/
    └── latest.tar.gz           # Last successful deploy bundle

/etc/
├── fail2ban/jail.local         # SSH brute-force protection
├── ufw/                        # Firewall rules (managed by ufw CLI)
└aptic/                         # Auto-update schedule

/var/log/wwf/
├── nginx-access.log
├── nginx-error.log
├── app.log                     # Next.js stdout
└── prometheus/
```

### 5.2 Docker Compose — main stack (`/srv/wwf/docker-compose.yml`)

```yaml
services:
  app:
    image: wwf-app:latest
    build: .
    restart: unless-stopped
    expose: ["3000"]
    environment:
      DATABASE_URL: postgresql://wwf:${POSTGRES_PASSWORD}@postgres:5432/wwf
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
      AUTH_SECRET: ${AUTH_SECRET}
      GROQ_API_KEY: ${GROQ_API_KEY}
      UPSTASH_REDIS_REST_URL: ${UPSTASH_REDIS_REST_URL}
      UPSTASH_REDIS_REST_TOKEN: ${UPSTASH_REDIS_REST_TOKEN}
      SMTP_HOST: smtp.gmail.com
      SMTP_PORT: "465"
      SMTP_SECURE: "true"
      SMTP_USER: wwfcrotone26@gmail.com
      SMTP_PASS: ${SMTP_PASS}
      ADMIN_NOTIFY_EMAIL: wwfcrotone26@gmail.com
      SENTRY_DSN: ${SENTRY_DSN}
      NEXT_PUBLIC_SITE_URL: https://wwfprovinciadicrotone.it
      NEXT_PUBLIC_VERGARI_URL: https://www.riservanaturaledelvergari.it/
      TRUSTED_PROXY_HEADER: cf-connecting-ip
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [appnet]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  migrate:
    image: wwf-app:latest
    build: .
    restart: "no"
    command: ["npx", "prisma", "migrate", "deploy"]
    environment: # same as app
    depends_on:
      postgres: { condition: service_healthy }
    networks: [appnet]

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: wwf
      POSTGRES_USER: wwf
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /srv/wwf/postgres/data:/var/lib/postgresql/data
    expose: ["5432"]
    networks: [appnet]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wwf -d wwf"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--maxmemory", "128mb", "--maxmemory-policy", "allkeys-lru"]
    expose: ["6379"]
    networks: [appnet]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - /srv/wwf/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /srv/wwf/nginx/conf.d:/etc/nginx/conf.d:ro
      - /var/log/wwf:/var/log/wwf
    depends_on:
      app: { condition: service_healthy }
    networks: [appnet]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  appnet:
    driver: bridge
```

### 5.3 Monitoring stack (`/srv/wwf/docker-compose.monitoring.yml`)

```yaml
services:
  prometheus:
    image: prom/prometheus:v2.55.0
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    volumes:
      - /srv/wwf/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    expose: ["9090"]
    networks: [monnet]

  grafana:
    image: grafana/grafana:11.3.0
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana-data:/var/lib/grafana
    expose: ["3001"]
    networks: [monnet, appnet]

  node-exporter:
    image: prom/node-exporter:v1.8.2
    restart: unless-stopped
    command: ['--path.rootfs=/host', '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)']
    volumes:
      - /:/host:ro,rslave
    expose: ["9100"]
    networks: [monnet]

  nginx-exporter:
    image: nginx/nginx-prometheus-exporter:1.3.0
    restart: unless-stopped
    command:
      - '--nginx.scrape-uri=http://nginx/stub_status'
    depends_on:
      - nginx  # in main stack — uses appnet
    networks: [appnet, monnet]

volumes:
  prometheus-data:
  grafana-data:

networks:
  monnet:
    driver: bridge
  appnet:
    external: true
```

### 5.4 Nginx config (`/srv/wwf/nginx/conf.d/app.conf`)

```nginx
# Real client IP from Cloudflare
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;

# Rate limit (defense in depth — Nginx layer in front of app rate limits)
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

upstream nextjs {
    server app:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name wwfprovinciadicrotone.it www.wwfprovinciadicrotone.it admin.wwfprovinciadicrotone.it;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wwfprovinciadicrotone.it www.wwfprovinciadicrotone.it admin.wwfprovinciadicrotone.it;

    ssl_certificate     /etc/ssl/cloudflare/cert.pem;
    ssl_certificate_key /etc/ssl/cloudflare/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers (also set in middleware, but defense in depth)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 10M;

    # Logging
    log_format wwf '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';
    access_log /var/log/wwf/nginx-access.log wwf;
    error_log  /var/log/wwf/nginx-error.log warn;

    # Static assets — Nginx serves directly, bypasses Next.js
    location /images/ {
        alias /srv/wwf/assets/images/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location /logos/ {
        alias /srv/wwf/assets/logos/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location /downloads/ {
        alias /srv/wwf/assets/downloads/;
        expires 1d;
        try_files $uri =404;
    }

    location /uploads/ {
        alias /srv/wwf/assets/uploads/;
        expires 1d;
        try_files $uri =404;
    }

    # API rate limit
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Everything else
    location / {
        limit_req zone=general burst=60 nodelay;
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Health check (no logging)
    location = /health {
        access_log off;
        return 200 "ok\n";
    }
}
```

### 5.5 systemd + auto-restart

Docker's `restart: unless-stopped` handles crashes. Server OS-level restart is handled by Hetzner (auto-power-on).

### 5.6 Backups

**WAL-G setup:**
```bash
# /srv/wwf/walg/env
WALG_S3_PREFIX=s3://wwf-backups
AWS_ACCESS_KEY_ID=${BACKBLAZE_B2_KEY_ID}
AWS_SECRET_ACCESS_KEY=${BACKBLAZE_B2_APPLICATION_KEY}
AWS_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
AWS_REGION=eu-central-003
WALG_COMPRESSION_METHOD=lz4
WALG_DELTA_MAX_STEPS=5

# crontab
0 3 * * *  docker exec postgres bash -c 'wal-g backup-push $PGDATA'
* * * * *  docker exec postgres bash -c 'wal-g wal-push $PGDATA/pg_wal'
0 4 * * 0  /srv/wwf/scripts/test-restore.sh
```

**Restore drill script** (`/srv/wwf/scripts/test-restore.sh`):
1. Pulls latest base backup from B2
2. Spins up throwaway Postgres container
3. Restores + runs `pg_dump --schema-only` to validate
4. Emails result to `wwfcrotone26@gmail.com`
5. Tears down container

---

## 6. Pre-launch checklist

### 6.1 Credentials you need to provide

**Cloudflare:**
- `CLOUDFLARE_API_TOKEN` — scope: `Zone:Read, Zone:Edit, DNS:Edit, Email Routing:Edit, Access:Edit`
- `CLOUDFLARE_ACCOUNT_ID` — from the dashboard sidebar
- `CLOUDFLARE_ZONE_ID` — after the .it domain is added

**Hetzner:**
- `HETZNER_API_TOKEN` — scope: Read & Write
- `HETZNER_SSH_PUBLIC_KEY` — the public key you'll use to SSH in

**Backblaze B2:**
- `BACKBLAZE_B2_KEY_ID`
- `BACKBLAZE_B2_APPLICATION_KEY`
- `BACKBLAZE_B2_BUCKET_NAME` (must create `wwf-backups` first)

**Upstash:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Sentry:**
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` (for sourcemap upload from GitHub Actions)
- `SENTRY_ORG`
- `SENTRY_PROJECT`

**App secrets (to be generated and stored on VPS):**
- `AUTH_SECRET` — `openssl rand -base64 48`
- `POSTGRES_PASSWORD` — `openssl rand -base64 32`
- `GRAFANA_ADMIN_PASSWORD` — `openssl rand -base64 24`
- `GROQ_API_KEY` — you already have one

**Existing (no change):**
- `SMTP_USER` = `wwfcrotone26@gmail.com`
- `SMTP_PASS` = your existing Gmail app password

### 6.2 Step-by-step provisioning

#### Step 1 — Cloudflare account + domain (you, ~10 min)
1. Sign up at https://dash.cloudflare.com/
2. Click "Add a site" → `wwfprovinciadicrotone.it`
3. Choose Free plan initially (we upgrade after)
4. Cloudflare will scan for existing DNS records — accept whatever it finds
5. Cloudflare assigns two nameservers (e.g. `anna.ns.cloudflare.com`, `bob.ns.cloudflare.com`)
6. NIC.it sends a verification email to the address you registered with — click the link
7. NIC.it emails you again when the domain is delegated — log in to NIC.it and confirm the nameservers
8. In Cloudflare dashboard → Billing → Subscribe → Pro ($20/mo)

#### Step 2 — Hetzner Cloud account + VPS (you, ~10 min)
1. Sign up at https://console.hetzner.cloud/
2. Create a new project: `wwf-crotone`
3. Add your SSH public key: Security → SSH Keys → Add
4. Add a server:
   - Location: Falkenstein (FSN)
   - Image: Ubuntu 24.04
   - Type: CCX23 (Intel/AMD dedicated vCPU, 4 vCPU, 16 GB)
   - Networking: Public IPv4 + IPv6
   - SSH key: your key
   - Name: `wwf-prod-01`
5. Note the public IPv4 (e.g. `78.46.123.45`)

#### Step 3 — Backblaze B2 (you, ~5 min)
1. Sign up at https://www.backblaze.com/b2/
2. Create a bucket: `wwf-backups`, Private, EU-central region
3. Create application key: `wwf-backups-key`, with read+write to this bucket only
4. Note the `keyID` and `applicationKey`

#### Step 4 — Upstash Redis (you, ~2 min)
1. Sign up at https://console.upstash.com/
2. Create database: `wwf-rate-limit`, region: EU (closest to Hetzner)
3. Note the REST URL and token

#### Step 5 — Sentry (you, ~5 min)
1. Sign up at https://sentry.io
2. Choose Team plan ($26/mo)
3. Create project → Platform: Next.js
4. Note: DSN, Auth Token, Org slug, Project slug

#### Step 6 — Bootstrapping the VPS (me, ~30 min after you provide SSH access)
1. SSH in as `root`
2. Update + install base packages
3. Install Docker + Docker Compose plugin
4. Configure UFW firewall
5. Install + configure fail2ban
6. Configure unattended-upgrades for security patches
7. Create `deploy` user (non-root)
8. Create `/srv/wwf/` directory tree
9. Drop in `.env`, `docker-compose.yml`, nginx config, WAL-G env
10. `docker compose up -d`
11. Set up `cloudflared` tunnel OR configure Nginx with Cloudflare Origin certificate
12. Run `prisma migrate deploy` + `tsx prisma/seed.ts`
13. Smoke test all endpoints

#### Step 7 — DNS + Cloudflare config (me, ~15 min)
1. Add all DNS records (A, MX, TXT, DMARC)
2. Configure Email Routing (info@ → Gmail)
3. Configure Cloudflare Access for `status.wwfprovinciadicrotone.it`
4. Configure WAF rules (block known bad paths, geo-restrict /admin to Italy + EU if desired)
5. Configure rate-limit rules at the edge

#### Step 8 — CI/CD (me, ~30 min)
1. Generate deployment SSH key (one on VPS, public key in GitHub Actions secret)
2. Add `HETZNER_SSH_PRIVATE_KEY`, `HETZNER_VPS_IP`, `SENTRY_AUTH_TOKEN` to GitHub repo secrets
3. Write `.github/workflows/deploy.yml`

#### Step 9 — Pre-launch audit (me, ~1 hour)
- Security review (CSP, headers, auth, rate limits)
- Performance (Lighthouse, bundle size)
- Accessibility (axe-core, manual keyboard test)
- GDPR (cookie consent, data export, delete)
- Smoke tests (booking flow, magic link, receipt upload, admin approval)

#### Step 10 — DNS cutover + monitoring (me, ~30 min)
- Set TTL to 300s 24h before cutover (cache invalidation ready)
- Cutover: change NIC.it nameservers if not already done
- Wait for propagation (up to 24h)
- Enable Grafana alerts (email on high error rate, low disk, etc.)

---

## 7. Cost summary

| Item | Monthly | Yearly |
|---|---|---|
| Domain `wwfprovinciadicrotone.it` | — | ~€12/yr |
| Hetzner CCX23 | €29.90 | €358.80 |
| Cloudflare Pro | $20 | $240 |
| Sentry Team | $26 | $312 |
| Backblaze B2 (estimated 5 GB) | $0.03 | $0.40 |
| Upstash Redis (free tier) | $0 | $0 |
| Cloudflare Email Routing (free) | $0 | $0 |
| Cloudflare Access (free ≤50 users) | $0 | $0 |
| **Total** | **~$46/mo + €29.90/mo** | **~$552/yr + €371/yr** |

At EUR/USD ~1.08, that's **~$78/mo or ~$940/yr total**.

---

## 8. Capacity planning

| Metric | Current usage | Capacity | Headroom |
|---|---|---|---|
| Database size | ~50 MB (12 turns + bookings) | 20 GB on VPS | 400× |
| Disk | ~3 GB (images + DB + logs) | 160 GB | 50× |
| RAM | ~3 GB (Postgres + Redis + Next.js) | 16 GB | 5× |
| CPU | ~5% baseline, peaks at 30% during camp sign-ups | 4 vCPU | 10× baseline, 3× peak |
| Bandwidth | ~10 GB/mo | unmetered via CF | infinite |
| Concurrent users | ~50 during peak | thousands via Nginx | 20× |

We can handle **10× current load without scaling**. If we ever exceed that (unlikely for a volunteer camp), upgrade to CCX33 (8 vCPU, 32 GB) for €57.90/mo — still cheap.

---

## 9. Disaster recovery

| Scenario | RTO (downtime) | RPO (data loss) | How |
|---|---|---|---|
| App crash | <30s (Docker restart) | 0 | `restart: unless-stopped` |
| VPS reboot | <2 min | 0 | Hetzner auto-power-on |
| Postgres corruption | <1 hour | 0 (full DB backup) | `docker exec postgres bash -c 'wal-g backup-fetch ...'` |
| Disk full | <30 min | 0 | Increase volume in Hetzner, redeploy |
| VPS lost | <4 hours | <16 MB WAL (≈1 minute of writes) | Re-provision VPS + `wal-g backup-fetch` + restore |
| Hetzner region down | <24 hours | <16 MB WAL | Provision new VPS in different region, restore from B2 |
| Cloudflare down | <5 min | 0 | Site unreachable but no data loss — CF caches most assets |
| B2 region down | n/a | n/a | B2 has multiple regions; we use EU-central, backup is already off-site |
| Ransomware on VPS | <8 hours | <24h | Restore from B2 (B2 bucket is separate credentials) |
| Sentry outage | <1 hour | 0 (errors only, not user data) | Errors queue locally, retry on reconnect |

---

## 10. Compliance checklist

### GDPR (EU)
- ✅ EU data residency (Hetzner Falkenstein + B2 EU region)
- ✅ Privacy policy in place (`/privacy` + `/cookie`)
- ✅ Cookie consent banner (Plausible Analytics)
- ✅ Self-service data export (`/account/profile`)
- ✅ Self-service account deletion request (`/account/profile` → emails admin)
- ✅ TLS everywhere (HSTS preload)
- ✅ CSP strict (no unsafe-inline in prod)
- ✅ PII scrubbing in Sentry (beforeSend hooks)
- ✅ Audit log for every booking edit
- ⏳ DPIA (Data Protection Impact Assessment) — should be done before launch, contact your DPO

### Italian PEC
- ✅ `wwfcrotone@legalmail.it` maintained separately (out of scope for this site)

### WCAG 2.1 AA
- ✅ Keyboard navigation
- ✅ Focus management in chat widget
- ✅ ARIA labels on icon-only buttons
- ✅ Skip-to-content link
- ✅ Color contrast verified in light + dark mode
- ⏳ Manual screen reader test (NVDA + VoiceOver) before launch

---

## 11. Operational runbook

### Deploy a new version
```bash
git push origin main
# GitHub Actions builds, tests, deploys to VPS
# Watch: https://github.com/EliseyRotar/wwf-crotone-website/actions
```

### Roll back
```bash
git revert HEAD && git push origin main
# OR on the VPS:
ssh deploy@<vps>
cd /srv/wwf && docker compose pull && docker compose up -d --force-recreate app
```

### Check logs
```bash
ssh deploy@<vps>
docker logs --tail 100 -f wwf-app-1
tail -f /var/log/wwf/nginx-access.log
```

### Manual DB backup
```bash
ssh deploy@<vps>
docker exec postgres bash -c 'wal-g backup-push $PGDATA'
```

### Restore from backup
```bash
ssh deploy@<vps>
docker compose stop app
docker exec postgres bash -c 'wal-g backup-fetch /tmp/restore'
docker exec postgres bash -c 'rm -rf $PGDATA && mv /tmp/restore $PGDATA'
docker compose start postgres app
```

### Rotate secrets
```bash
ssh deploy@<vps>
openssl rand -base64 48 > /srv/wwf/.env.new
# Edit .env.new with the new secret
mv /srv/wwf/.env.new /srv/wwf/.env
cd /srv/wwf && docker compose up -d --force-recreate app
```

### Add an admin user
```bash
ssh deploy@<vps>
docker exec -it wwf-app-1 npx tsx scripts/create-admin.ts --email paolo@wwf.it --role superadmin
```

---

## 12. Open questions for you (before deployment)

1. **Cloudflare WAF rules** — strict, balanced, or minimal? Recommended: balanced (block known-bad, allow normal traffic).
2. **Geo-restrict /admin** — should only Italian IPs reach `/admin`? Or trusted IP allowlist?
3. **Cookie banner analytics provider** — keep Plausible (privacy-first, no consent needed) or switch to GA4 (requires consent)?
4. **DPIA** — do you have a Data Protection Officer or do you need help drafting one?
5. **WhatsApp number** — confirm `+39 351 3945109` for the wa.me link?
6. **Grafana admin users** — just you, or also Paolo?
7. **Pre-launch comms** — do you want a maintenance page during the cutover?
8. **Backup retention** — 30 days OK, or longer for compliance?
9. **Test domain for staging** — `staging.wwfprovinciadicrotone.it` to test deploys before going live?

---

**End of architecture document. Next step: provision the accounts in §6.1, then paste credentials and I'll execute §6.2 steps 6-10.**
