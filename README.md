# 🌿 WWF Crotone — Volunteer Camps 2026

The official website of **WWF Provincia di Crotone-ETS**, a local
section of WWF Italia ETS.

> 🇮🇹 [Versione italiana di questo README](./README.it.md)

---

## What is this?

Every summer, WWF Crotone runs **12 weekly volunteer camps** (June –
September) in **San Leonardo di Cutro, Calabria**, where volunteers
help protect **Caretta caretta** sea turtles on the Ionian coast.

This website is where:

- 📅 Volunteers browse the 12 camp weeks and **book their spot**
  ([wwfcrotone.it/dates](https://wwfcrotone.it/dates))
- 🐢 Anyone curious about the project learns what the camps actually
  do — turtle nest monitoring, beach cleanups, wildlife rescue,
  marine biology — and where volunteers stay (the **C.E.L.A.**, a
  property confiscated from organised crime and returned to the
  community)
- 💬 Visitors ask questions to **Totò the AI assistant**, a chatbot
  trained on the 2026 camp brochure
- 🛡️ WWF staff manage registrations, payments, and operators from the
  Italian-only admin panel

The site is live at **[wwfcrotone.it](https://wwfcrotone.it)** and
serves about a hundred volunteers per season, plus a wider audience of
supporters and curious visitors year-round.

---

## Screenshots

| Home | Campi (date + booking) |
|---|---|
| ![Homepage](docs/screenshots/01-homepage.png) | ![Date e prenotazione](docs/screenshots/02-dates-and-booking.png) |
| **Contatti** | **FAQ** |
| ![Contatti](docs/screenshots/03-contact.png) | ![FAQ](docs/screenshots/04-faq.png) |
| **Galleria** | **Admin** (login, Italian-only) |
| ![Galleria](docs/screenshots/05-gallery.png) | ![Admin](docs/screenshots/06-admin-login.png) |

Mobile view of the homepage:

![Homepage mobile](docs/screenshots/07-homepage-mobile.png)

---

## About the project

| | |
|---|---|
| **Organisation** | WWF Provincia di Crotone-ETS (ODV) |
| **Codice Fiscale** | `91034580794` |
| **Sede legale** | Località Marinella, San Leonardo di Cutro, 88842 Cutro (KR), Calabria, Italia |
| **Presidente** | Paolo Asteriti |
| **Founded** | 2010s (ODV under D.Lgs. 117/2017) |
| **Domain** | [wwfcrotone.it](https://wwfcrotone.it) (Aruba) |
| **Cost** | ~€93/yr to run (domain + VPS + all third-party free tiers) |

### Mission in one sentence

> Protect Mediterranean sea turtles and their habitat through
> volunteer-powered monitoring, education, and habitat restoration —
> on land confiscated from organised crime and given back to the
> community.

### What the camps actually do

Each week, ~15 volunteers stay at the **C.E.L.A.** (Centro per
l'Educazione alla Legalità e all'Ambiente) and work alongside WWF
operators on:

- **Night patrols** to monitor *Caretta caretta* nesting activity on
  the beaches of the **AMP Capo Rizzuto** (Capo Rizzuto Marine
  Protected Area)
- **Beach cleanups** in collaboration with local municipalities
- **Nest protection and hatchling release** in late summer (August –
  September)
- **Wildlife rescue** with the **CRAS** of Catanzaro (Centro Recupero
  Animali Selvatici)
- **Education activities** at the **CRTM** (Centro Recupero Tartarughe
  Marine) and the **Acquarium CEAM** in Crotone
- **Citizen science** — every observation goes into the national WWF
  database

There are 12 camp turns, each running Sunday to Sunday. Most weeks
have 12–20 volunteers of all ages, with parental consent required for
minors. The Belgian delegation has joined us for several years.

You can read the full story, including the **Totò the turtle dog**
legend, the **TARTAMar project**, and the C.E.L.A. confiscated-property
background, on the [FAQ page](https://wwfcrotone.it/faq) or in the
chatbot.

---

## This repository

This is the open-source code that powers [wwfcrotone.it](https://wwfcrotone.it).
The project was rebuilt from scratch in 2026 with the following goals:

- A **bilingual** site (Italian + English) so international volunteers
  can apply without speaking Italian
- A **booking flow** that handles the messy real-world details:
  minors, allergies, dietary needs, multi-week stays, payment
  confirmation
- An **admin panel** that the WWF staff can actually use without
  calling us every time
- A **GDPR-compliant** data handling pipeline with full audit logs
  and a documented DPIA
- A **budget under €200/year** by combining a single small VPS with
  generous free tiers (Cloudflare, Groq, Upstash, Sentry Developer,
  Plausible, Brevo, Instatus, UptimeRobot)

### Tech, briefly

- **Next.js 15** App Router + TypeScript + Tailwind 3
- **Prisma** ORM, SQLite for dev, **PostgreSQL** for prod
- **next-intl** for Italian / English i18n
- **JWT** sessions (`jose` + `bcryptjs`)
- **Nodemailer** for transactional email (Brevo SMTP, with Gmail
  fallback)
- **Groq** (`llama-3.3-70b-versatile`) for the chatbot
- **Leaflet + OpenStreetMap** for the interactive map
- Deployed on a single **Netcup VPS 500 G12** (2 vCPU / 4 GB /
  128 GB NVMe) running Docker Compose (Next.js + Postgres + Redis +
  Nginx + WAL-G)
- HTTPS via **Cloudflare Universal SSL** with a CF Origin
  certificate pinning CF↔origin encryption

### Repo layout

```
docs/          # ARCHITECTURE, DPIA, SETUP, screenshots
infra/         # docker-compose, nginx, VPS bootstrap scripts
prisma/        # schema, seed scripts, 2026 import data
src/           # all app code (Next.js App Router)
public/        # static assets (logos, gallery, brochure)
.github/       # CI + deploy workflows
LICENSE*       # AGPL-3.0 (code), CC BY-NC-SA (content), trademark
```

For the technical deep-dive see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
For GDPR documentation see [`docs/DPIA.md`](docs/DPIA.md).
To **run a copy of this site yourself** see [`docs/SETUP.md`](docs/SETUP.md).

---

## Contributing

This codebase is the working file of a single volunteer project, not
an open-source community. We're happy to share it, and we're happy to
talk to other NGOs who want to adapt it — but please don't open drive-by
PRs without a conversation first.

If you're a WWF section or another Italian non-profit interested in
forking the code, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

If you spot a security issue, please email **wwfcrotone26@gmail.com**
rather than opening a public issue.

---

## Credits

- **WWF Crotone** — Paolo Asteriti (Presidente) and the whole
  volunteer team
- **Camp operators** — Luca, Lorenzo, Luigi, Carlo, Elena, Giulia,
  Nadia, Nicola (named in the 2026 operatori roster)
- **Belgian delegation** — for joining us every year since 2023
- **Site development** — Elisey Rotar
- **Photography** — WWF Crotone volunteers + Wikimedia Commons
  (CC-licensed photos credited inline)
- **Design language** — based on [wwf.it](https://www.wwf.it)
- **AI** — powered by [Groq](https://groq.com) (`llama-3.3-70b-versatile`)
- **Hosting** — Netcup + Cloudflare
- **The volunteers** — for showing up every summer

---

## License

This repository contains three kinds of material with different
licenses:

- **Source code** (`src/`, `prisma/`, `infra/`, `.github/`, root config
  files) — [AGPL-3.0](./LICENSE.code). Any organisation running a
  modified version as a network service must publish their source.
- **Site content** (text, FAQ items, brochure copy, blog posts, chatbot
  knowledge) — [CC BY-NC-SA 4.0](./LICENSE.content). Free to share
  and adapt with attribution, non-commercial, share-alike.
- **Trademarks** (WWF panda logo, "WWF" name) — see
  [LICENSE.trademark](./LICENSE.trademark). All rights reserved by
  WWF International / WWF Italia.

See [LICENSE](./LICENSE) for the summary and rationale.

---

*Costruiamo un mondo in cui le persone possano vivere in armonia con la natura.*
