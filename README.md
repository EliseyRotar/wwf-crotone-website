# 🌿 WWF Crotone — Campi di Volontariato 2026

Official website for **WWF PROVINCIA DI CROTONE-ETS** (local section of WWF Italia ETS) volunteer camps in San Leonardo di Cutro (KR), Calabria, Italy.

## About

This website handles online registration for 12 weekly volunteer camp turns (June–September 2026), where participants help monitor **Caretta caretta** sea turtle nests, clean beaches in the **Capo Rizzuto Marine Protected Area**, rescue wildlife with the **CRAS of Catanzaro**, and more. Volunteers stay at the **C.E.L.A.** (Center for Education on Legality and Environment) — a property confiscated from organised crime and returned to the community.

> 📘 The FAQ and the AI chatbot knowledge base are curated from the 2026 camp brochure, including the TARTAMar project story, the C.E.L.A. confiscated-property background, and **Totò the turtle dog**.

## Legal Identity

The organization is an **ODV** (Organizzazione di Volontariato) registered under **D.Lgs. 117/2017** (Codice del Terzo Settore). The values below are taken verbatim from the Statuto and Atto Costitutivo and are also exported from `src/config/site.ts` as the `ORG` constant for use on legal/regulatory surfaces (privacy policy, cookie banner, ricevute, PEC headers, etc.).

| Field | Value |
|---|---|
| Legal name | `WWF PROVINCIA DI CROTONE-ETS` |
| Forma giuridica | Organizzazione di Volontariato (ODV) |
| Codice Fiscale | `91034580794` |
| Sede legale | Località Marinella San Leonardo di Cutro, 88842 Cutro (KR), Calabria, Italia |
| Presidente | Paolo Asteriti (CF `STRPLA75B18D122G`) |
| PEC | `wwfcrotone@legalmail.it` |
| Email | `wwfcrotone26@gmail.com` |
| Telefono (campo) | `+39 351 3945109` |
| IBAN | `IT30V0306909606100000107334` |
| Dominio | `wwfcrotone.it` (registrar: Aruba) |

```ts
// src/config/site.ts
export const ORG = {
  legalName: "WWF PROVINCIA DI CROTONE-ETS",
  formaGiuridica: "Organizzazione di Volontariato (ODV)",
  codiceFiscale: "91034580794",
  sedeLegale: "Località Marinella San Leonardo di Cutro, 88842 Cutro (KR)",
  presidente: "Paolo Asteriti",
  presidenteCF: "STRPLA75B18D122G",
  pec: "wwfcrotone@legalmail.it"
} as const;
```

## Features

- **Multi-page bilingual site** (Italian / English) with automatic browser language detection
- **12 weekly camp turns** with real-time availability status (Posti liberi / Pochi posti / Completo / Concluso)
- **Multi-turn registration** — volunteers can sign up for multiple consecutive weeks with automatic total cost calculation
- **Multi-step booking form** with server-side validation:
  - Personal data with automatic minor/adult detection from birth date
  - Health & diet (swimming ability, tetanus status, allergies, dietary needs — all required)
  - Logistics (arrival mode, arrival/departure times with time window warnings for public transport)
  - Consents (GDPR privacy, marketing, image/video — image consent defaults to yes)
  - Parental/guardian consent automatically required for minors
- **Admin panel** (`/admin`) with role-based access:
  - Dashboard with turn occupancy stats
  - Iscrizioni management (view full details, edit, delete, export CSV)
  - Payment tracking split into €100 registration fee + remaining balance
  - Operators/staff management (add, edit, delete with role assignment)
  - Turn capacity configuration
  - Gallery management (upload photos, add YouTube videos)
  - User account management (superadmin only) with auto-expiry
- **Gallery** with filterable masonry grid (CRTM, Progetto Tartamar, Turtle Dog, beach cleanup, wildlife, camp life, hatchings, culture) + lightbox + dedicated hatching video section
- **FAQ** — 44+ items in 7 categories (General, Registration, Logistics, Health, Payment, Activities, After-camp) with category chips, search bar, helpfulness feedback, JSON-LD structured data
- **Interactive map** — Leaflet + OpenStreetMap with 6 markers (C.E.L.A., AMP Capo Rizzuto, Vergari Reserve, CRTM, Aquarium CEAM, Crotone) and theme-reactive tile swap
- **AI Chatbot** — Floating widget powered by Groq (`llama-3.3-70b-versatile`, free tier) answering questions about the camp in IT/EN. Includes anti-jailbreak system prompt, prompt-injection pre-flight filter, PII redaction (Italian mobile + IBAN), 5 req/hour/IP rate limit, and streaming SSE responses
- **Dark mode** with system preference detection + manual toggle, no FOUC
- **SEO**: JSON-LD structured data (NGO + EventSeries), per-page metadata, OpenGraph/Twitter cards, canonical URLs, sitemap.xml, robots.txt
- **Security**: JWT session auth re-validated against DB, rate limiting, CSP headers with per-request nonces, upload magic-byte validation, honeypot anti-spam field, server-side input validation (zod), atomic capacity checks

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 + CSS variables (dark mode) |
| Database | Prisma ORM + SQLite (dev) → PostgreSQL (prod) |
| Auth | JWT (jose) + bcryptjs, cookie-based sessions |
| i18n | next-intl (IT/EN with browser autodetect) |
| Email | Nodemailer (Gmail SMTP) |
| AI Assistant | Groq (`llama-3.3-70b-versatile`, OpenAI-compatible client) |
| Maps | Leaflet + OpenStreetMap (theme-reactive tiles) |
| Icons | lucide-react |
| Fonts | Oswald (headings) + Inter (body) via next/font |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/EliseyRotar/wwf-crotone-website.git
cd wwf-crotone-website

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see Configuration below)

# Initialize the database
npx prisma db push
npx prisma generate

# Seed the 12 camp turns + gallery
npx tsx prisma/seed.ts

# Import existing registrations (optional)
npx tsx prisma/import-existing.ts

# Seed operators (optional)
npx tsx prisma/seed-operatori.cjs

# Run the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Admin Access

The seed creates a superadmin account. **Change the password immediately after first login.**

```
URL: http://localhost:3000/admin/login
Email: admin@wwfcrotone.it
Password: WWFcroton3_2026!
```

## Configuration

Create a `.env` file in the project root:

```env
# Database (dev = SQLite, prod = PostgreSQL)
DATABASE_URL="file:./dev.db"

# Auth — generate with: openssl rand -base64 48
AUTH_SECRET="your-secret-here"

# SMTP (Gmail) — for registration notification emails
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-app-password"
ADMIN_NOTIFY_EMAIL="wwfcrotone26@gmail.com"

# Public site URL (used for SEO, canonical, sitemap)
NEXT_PUBLIC_SITE_URL="https://wwfcrotone.it"
NEXT_PUBLIC_VERGARI_URL="https://www.riservanaturaledelvergari.it/"

# AI Chat Assistant (Groq free tier) — https://console.groq.com/keys
GROQ_API_KEY="gsk_..."

# Rate Limiting (optional) — Upstash Redis for distributed rate limit
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Trusted proxy header for rate limit client key (e.g. cf-connecting-ip, x-real-ip)
TRUSTED_PROXY_HEADER=""

# Admin token for /api/iscrizione/lookup bypass (for staff scripts)
LOOKUP_ADMIN_TOKEN=""
```

### AI Provider Choice

We chose **Groq** as the chatbot backend after evaluating the alternatives:

| Provider | Verdict |
|---|---|
| **Groq** ✅ | 1,000 RPD free tier, 30 RPM, 100K TPD, `llama-3.3-70b-versatile` is strong in Italian, OpenAI-compatible API, no credit card required |
| Google AI Studio | Plausible fallback — Gemini 2.0 Flash has a generous free tier |
| Mistral | Free tier is limited and rate-constrained |
| OpenRouter | Free models vary in quality and availability |
| Cohere | Rejected — weaker Italian, less generous free tier |

Groq is more than enough for a small volunteer camp site. If the free tier ever becomes insufficient, switching providers only requires changing the API endpoint and model name in `src/lib/chatbot-knowledge.ts` (and the SDK call in `src/app/api/chat/route.ts`) — the OpenAI SDK is used throughout.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed 12 turns + gallery |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

## Project Structure

```
├── prisma/
│   ├── schema.prisma          # Database models
│   ├── seed.ts                # Seed 12 turns + gallery
│   ├── import-existing.ts     # Import registrations from Excel
│   └── seed-operatori.cjs      # Seed camp operators/staff
├── public/
│   ├── images/gallery/        # Camp photos (from PDF + Wikimedia Commons)
│   ├── logos/                  # WWF logo files
│   └── downloads/              # Camp brochure PDF
├── src/
│   ├── app/
│   │   ├── [locale]/          # Public pages (IT/EN)
│   │   │   ├── page.tsx       # Home
│   │   │   ├── about/          # Chi siamo
│   │   │   ├── activities/     # Attività
│   │   │   ├── dates/          # Date e Prenotazione (booking form)
│   │   │   ├── gallery/        # Galleria
│   │   │   ├── faq/            # FAQ
│   │   │   ├── contact/        # Contatti
│   │   │   └── privacy/        # Privacy + Cookie policy
│   │   ├── admin/             # Admin panel (Italian-only)
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── login/         # Admin login
│   │   │   ├── iscrizioni/    # Volunteer registrations
│   │   │   ├── operatori/     # Camp operators/staff
│   │   │   ├── turni/         # Turn capacity config
│   │   │   ├── gallery/       # Gallery upload
│   │   │   └── utenti/        # User account management
│   │   ├── api/               # API routes
│   │   │   ├── iscrizione/     # Public registration endpoint
│   │   │   ├── newsletter/    # Newsletter signup
│   │   │   ├── chat/          # AI chatbot (SSE streaming)
│   │   │   └── admin/         # Admin API routes
│   │   ├── globals.css        # Global styles + dark mode tokens
│   │   ├── sitemap.ts         # Sitemap.xml
│   │   └── robots.ts          # Robots.txt
│   ├── components/            # React components
│   ├── lib/                  # Utilities (auth, prisma, mail, rateLimit, chatbot-knowledge)
│   ├── messages/             # i18n translation files
│   │   ├── it.json
│   │   └── en.json
│   ├── i18n.ts               # next-intl config
│   └── middleware.ts          # Locale detection + routing
├── next.config.js            # Next.js config + CSP headers + i18n plugin
├── tailwind.config.js        # Tailwind + WWF design tokens
└── prisma/schema.prisma      # Database schema
```

## Deployment

Production is a single VPS (Contabo Cloud VPS 4, DE) running the stack defined in
`infra/docker-compose.yml` — Next.js 15 standalone + Postgres 16 + Redis 7 +
Nginx 1.27 + WAL-G. TLS is terminated at the Cloudflare edge, and the
Cloudflare→origin hop is encrypted with a **Cloudflare Origin certificate** (15
years, pinned to `/etc/ssl/cloudflare/` on the VPS). DNS for `wwfcrotone.it` is
on Cloudflare; `status.wwfcrotone.it` is a CNAME to Instatus.

Deploys are automated via GitHub Actions (`.github/workflows/deploy.yml`) and
triggered by every push to `main` once CI is green. The job pulls the repo on
the VPS, rebuilds the `app` container, restarts Nginx, and runs
`scripts/smoke-test.sh` against `http://localhost`.

### GitHub Actions — required secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `VPS_SSH_KEY` | Private SSH key (Ed25519, no passphrase) authorized in `~/.ssh/authorized_keys` for the `deploy` user on the VPS. Treated as a deploy-only key — no sudo, no shell beyond `cd /srv/wwf && docker compose …`. |
| `VPS_HOST` | VPS IP or hostname (e.g. `wwf.example.com`). |
| `VPS_USER` | SSH user on the VPS (e.g. `deploy`). |
| `SENTRY_AUTH_TOKEN` | Sentry personal/auth token with `project:releases` + `project:releases:write` scopes. Used by `@sentry/cli` to create the release and upload sourcemaps. |
| `SENTRY_ORG` | Sentry organization slug. |
| `SENTRY_PROJECT` | Sentry project slug (must match `SENTRY_DSN` in `.env.production`). |

The CI workflow (`.github/workflows/ci.yml`) runs `typecheck`, `lint`, `test`,
and `build` in parallel on every PR and push to `main`. The `deploy` workflow
is gated on `workflow_run: workflows: [CI], types: [completed], branches: [main],
conclusion: success` — i.e. it only fires after CI is green.

### First-time VPS bootstrap (manual, one-time)

The GitHub Actions `deploy` job assumes the VPS is already prepared. Run the
following once, as `root`, on a fresh Ubuntu 22.04+ VPS:

```bash
# 1. System packages + Docker
apt-get update && apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg ufw fail2ban
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

# 2. Firewall
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable

# 3. deploy user (no password, sudo NOPASSWD only for docker)
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker" > /etc/sudoers.d/deploy-deploy

# 4. Authorize the GitHub Actions SSH key (paste the *public* half of VPS_SSH_KEY)
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
cat > /home/deploy/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAA… github-actions-deploy
EOF
chmod 600 /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh

# 5. Clone the repo
sudo -u deploy git clone https://github.com/EliseyRotar/wwf-crotone-website.git /srv/wwf/repo
sudo -u deploy mkdir -p /srv/wwf/{nginx/conf.d,nginx/log,assets/images,assets/logos,assets/downloads,assets/uploads,postgres/data,redis/data,scripts}
sudo -u deploy cp -r /srv/wwf/repo/infra/nginx/conf.d/* /srv/wwf/nginx/conf.d/
sudo -u deploy cp /srv/wwf/repo/infra/docker-compose.yml /srv/wwf/docker-compose.yml
sudo -u deploy cp /srv/wwf/repo/scripts/smoke-test.sh /srv/wwf/scripts/smoke-test.sh
chmod +x /srv/wwf/scripts/smoke-test.sh

# 6. Production env (see infra/.env.production.example for the full template)
sudo -u deploy nano /srv/wwf/.env.production   # chmod 600 automatically

# 7. Cloudflare Origin certificate (15y, *.wwfcrotone.it + wwfcrotone.it)
mkdir -p /etc/ssl/cloudflare
# …paste cert.pem and key.pem from the Cloudflare dashboard → SSL/TLS → Origin Server
chmod 600 /etc/ssl/cloudflare/key.pem

# 8. Bring up the stack
cd /srv/wwf && docker compose up -d --build
docker compose logs -f app    # wait for "Ready" + /api/health 200
```

After this, every push to `main` that passes CI is deployed automatically.
The first deploy job will run `prisma migrate deploy` (via the `migrate`
service in `infra/docker-compose.yml`) before bringing the new `app` image up.

### Local Docker (smoke test only)

```bash
docker build -t wwf-crotone .
docker run -p 3000:3000 --env-file .env wwf-crotone
```

### Manual (PM2 + Nginx) — legacy / fallback

```bash
git clone https://github.com/EliseyRotar/wwf-crotone-website.git
cd wwf-crotone-website
npm ci --production
npx prisma generate
npx prisma db push
npm run build
pm2 start npm --name "wwf-crotone" -- start
pm2 save && pm2 startup
```

### Environment checklist for production

- [ ] `DATABASE_URL` points to PostgreSQL (not SQLite)
- [ ] `AUTH_SECRET` generated with `openssl rand -base64 48` (no placeholder allowed at boot)
- [ ] `SMTP_USER` / `SMTP_PASS` set (Brevo or Gmail app password)
- [ ] `GROQ_API_KEY` set for the AI chatbot
- [ ] `NEXT_PUBLIC_SITE_URL` set to `https://wwfcrotone.it`
- [ ] `NODE_ENV=production`
- [ ] `TRUSTED_PROXY_HEADER=cf-connecting-ip` (Cloudflare in front)
- [ ] Cloudflare Origin certificate installed at `/etc/ssl/cloudflare/`
- [ ] Branch protection on `main` requires the **CI / build** check before merge
- [ ] Change the superadmin password after first login

## Design System

The design follows WWF Italia's visual language:

| Token | Light | Dark |
|---|---|---|
| Brand green | `#007932` | `#007932` |
| CTA orange | `#eb9c4b` | `#eb9c4b` |
| Text | `#101010` | `#e8e6e3` |
| Surface | `#ffffff` | `#141413` |
| Sand (alt sections) | `#f6f2ed` | `#1a1a18` |
| Headings | Oswald, uppercase | |
| Body | Inter | |

## Security

- **Cookie session** — 8h expiry, `Secure` always-on in production, `httpOnly` + `SameSite=strict`
- **AUTH_SECRET** — refuses to start with placeholder or missing value (no dev fallback)
- JWT sessions re-validated against DB on every request (deleted/demoted users lose access immediately)
- **CSP with per-request nonces** — `'unsafe-inline'` removed from `script-src` in production; middleware-generated nonces forwarded to inline scripts
- **Rate limiting**:
  - 3 registrations/hour/IP
  - 5 newsletter signups/hour/IP
  - 5 chat requests/hour/IP (chatbot)
  - 10 login attempts/15min/IP
  - 10 lookups/15min/IP (`/api/iscrizione/lookup`)
- **Persistent rate limit (optional)** — Upstash Redis-backed; falls back to in-memory when not configured. Anti-spoof: `clientKey()` ignores `X-Forwarded-For` in production, uses `TRUSTED_PROXY_HEADER` if set
- **GDPR-compliant newsletter** — consent IP + UA + timestamp recorded; signed unsubscribe token; `unsubscribedAt` field
- **Atomic capacity counter** (`Turno.bookedCount`) — prevents over-booking race on PostgreSQL
- **AI Chatbot hardening** — prompt-injection pre-flight filter, output PII redaction (Italian mobile + IBAN), role restricted to `user` only, control-char stripping
- **Sentry scrubbing** — `beforeSend` hooks strip request bodies/cookies for `/api/chat`, `/api/admin/*`, `/api/iscrizione` to prevent PII leakage to error tracking
- Content-Security-Policy with `frame-ancestors: none`, `object-src: none`
- Upload validation: MIME + magic-byte check, extension whitelist
- Server-side validation with zod for all public endpoints
- Honeypot anti-spam field
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, Referrer-Policy

## License

This project is proprietary to WWF Crotone — Sezione locale di WWF Italia ETS. All rights reserved.

## Credits

- **WWF Crotone** — Paolo Asteriti (Presidente)
- **Development** — Elisey Rotar (Tecnico)
- **Photos** — WWF Crotone volunteers + Wikimedia Commons (CC-licensed)
- **Design** — Based on [wwf.it](https://www.wwf.it) visual language
- **AI** — Powered by [Groq](https://groq.com) (`llama-3.3-70b-versatile`)

---

Costruiamo un mondo in cui le persone possano vivere in armonia con la natura.
