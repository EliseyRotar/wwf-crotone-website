# 🌿 WWF Crotone — Campi di Volontariato 2026

Official website for **WWF Crotone** (local section of WWF Italia ETS) volunteer camps in San Leonardo di Cutro (KR), Calabria, Italy.

## About

This website handles online registration for 12 weekly volunteer camp turns (June–September 2026), where participants help monitor **Caretta caretta** sea turtle nests, clean beaches in the **Capo Rizzuto Marine Protected Area**, rescue wildlife with the **CRAS of Catanzaro**, and more. Volunteers stay at the **C.E.L.A.** (Center for Education on Legality and Environment) — a property confiscated from organised crime and returned to the community.

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
- **Dark mode** with system preference detection + manual toggle, no FOUC
- **SEO**: JSON-LD structured data (NGO + EventSeries), per-page metadata, OpenGraph/Twitter cards, canonical URLs, sitemap.xml, robots.txt
- **Security**: JWT session auth re-validated against DB, rate limiting, CSP headers, upload magic-byte validation, honeypot anti-spam, server-side input validation (zod), transactional capacity checks

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
```

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
│   │   │   └── admin/         # Admin API routes
│   │   ├── globals.css        # Global styles + dark mode tokens
│   │   ├── sitemap.ts         # Sitemap.xml
│   │   └── robots.ts          # Robots.txt
│   ├── components/            # React components
│   ├── lib/                  # Utilities (auth, prisma, mail, rateLimit)
│   ├── messages/             # i18n translation files
│   │   ├── it.json
│   │   └── en.json
│   ├── i18n.ts               # next-intl config
│   └── middleware.ts          # Locale detection + routing
├── next.config.js            # Next.js config + CSP headers + i18n plugin
├── tailwind.config.js        # Tailwind + WWF design tokens
└── prisma/schema.prisma      # Database schema
```

## Deployment (VPS)

### Using Docker (recommended)

```bash
# Build and run
docker build -t wwf-crotone .
docker run -p 3000:3000 --env-file .env wwf-crotone
```

### Manual (PM2 + Nginx)

```bash
# On the VPS:
git clone https://github.com/EliseyRotar/wwf-crotone-website.git
cd wwf-crotone-website
npm ci --production
npx prisma generate
npx prisma db push
npm run build

# Start with PM2
pm2 start npm --name "wwf-crotone" -- start
pm2 save
pm2 startup
```

### Environment checklist for production

- [ ] `DATABASE_URL` points to PostgreSQL (not SQLite)
- [ ] `AUTH_SECRET` generated with `openssl rand -base64 48`
- [ ] `SMTP_USER` / `SMTP_PASS` set to Gmail app password
- [ ] `NEXT_PUBLIC_SITE_URL` set to your domain
- [ ] `NODE_ENV=production`
- [ ] Change the superadmin password after first login
- [ ] Configure Nginx reverse proxy with SSL (Let's Encrypt)

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

- JWT sessions re-validated against DB on every request (deleted/demoted users lose access immediately)
- `sameSite: strict` cookies with `httpOnly` + `secure` (production)
- Rate limiting: 3 registrations/hour/IP, 5 newsletter/hour/IP, 10 login attempts/15min/IP
- Content-Security-Policy with `frame-ancestors: none`, `object-src: none`
- Upload validation: MIME + magic-byte check, extension whitelist
- Server-side validation with zod for all public endpoints
- Honeypot anti-spam field
- Transactional capacity checks (no overbooking race conditions)
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, Referrer-Policy

## License

This project is proprietary to WWF Crotone — Sezione locale di WWF Italia ETS. All rights reserved.

## Credits

- **WWF Crotone** — Paolo Asteriti (Presidente)
- **Development** — Elisey Rotar (Tecnico)
- **Photos** — WWF Crotone volunteers + Wikimedia Commons (CC-licensed)
- **Design** — Based on [wwf.it](https://www.wwf.it) visual language

---

Costruiamo un mondo in cui le persone possano vivere in armonia con la natura.