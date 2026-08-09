# Documentation

Everything in this folder is documentation. Visitor-facing material
lives in [`README.md`](../README.md) and [`README.it.md`](../README.it.md).

## Technical documentation

- [`SETUP.md`](./SETUP.md) — how to run a copy of this site (local dev
  + production deployment). Read this if you want to install, build,
  or deploy.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system architecture, the
  €200/yr stack, and the trade-offs behind each technology choice.
- [`DPIA.md`](./DPIA.md) — GDPR Article 35 Data Protection Impact
  Assessment (bilingual, 10k+ words). Required reading before changing
  anything that handles personal data.

## Operational runbooks (one-time or rare)

- [`CLOUDFLARE_SETUP.md`](./CLOUDFLARE_SETUP.md) — programmatic
  Cloudflare zone setup (DNS, Email Routing, page rules).
- [`CLOUDFLARE_MANUAL_STEPS.md`](./CLOUDFLARE_MANUAL_STEPS.md) — the
  UI clicks you still have to make by hand after the API script runs.
- [`BREVO_SETUP.md`](./BREVO_SETUP.md) — Brevo SMTP + sender domain
  verification (DKIM, SPF, DMARC).
- [`vps-provider-research-2026-08.md`](./vps-provider-research-2026-08.md)
  — why we chose Netcup over Scaleway, Hetzner, etc.

## Working documents (not for public distribution)

- [`AUDIT_REPORT-2026-07.txt`](./AUDIT_REPORT-2026-07.txt) — internal
  audit from July 2026 with 150+ findings across security, bugs,
  performance, SEO, accessibility. Most have been addressed; the
  document is kept for traceability.

## Screenshots

[`screenshots/`](./screenshots/) — homepage, dates, contact, FAQ,
gallery, admin, and mobile views of the live site. Used in the README
and for documentation purposes.

---

## Conventions

- Files in **English** unless they're translations of legal / regulatory
  material (the DPIA is bilingual by design).
- Markdown only (`.md`), except the audit report which is plain text
  (`.txt`) to match its original format.
- Folder names are **lowercase-kebab-case**.
- Use [GitHub-flavored Markdown](https://github.github.com/gfm/).
