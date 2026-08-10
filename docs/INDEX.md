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
  Assessment (bilingual, ~750 lines). Sanitized for the public repo:
  org identity, codice fiscale, presidente details, and contact
  information are replaced with `[redacted]` placeholders. Full
  unredacted copy is on the org's internal storage only.
- [`SENTRY_SETUP.md`](./SENTRY_SETUP.md) — Sentry SDK wiring (errors
  + tracing), what we capture / don't capture, PII policy, and the
  production verification checklist.

## Service setup (references)

- [`CLOUDFLARE_SETUP.md`](./CLOUDFLARE_SETUP.md) — programmatic
  Cloudflare zone setup (DNS, Email Routing, page rules). Contact
  details redacted.
- [`BREVO_SETUP.md`](./BREVO_SETUP.md) — Brevo SMTP + sender domain
  verification (DKIM, SPF, DMARC). Contact details redacted.
- [`vps-provider-research-2026-08.md`](./vps-provider-research-2026-08.md)
  — why we chose Netcup over Scaleway, Hetzner, etc.

## Removed from public repo

These docs were moved to the org's local PC under
`~/Documents/wwf-private/` because they contain one-time setup
instructions or sensitive internal information that doesn't belong
in a public repository:

- `AUDIT_REPORT-2026-07.txt` — internal audit from July 2026 with
  150+ findings across security, bugs, performance, SEO, accessibility.
  Kept on local PC for traceability.
- `CLOUDFLARE_MANUAL_STEPS.md` — the UI clicks required to set up
  Cloudflare (already done). Single-use doc.
- `ROBE_LEGALI/` — Italian Ministry of Labour grant-reporting templates
  (see `~/Documents/wwf-private/ROBE_LEGALI/`).

## Screenshots

[`screenshots/`](./screenshots/) — homepage, dates, contact, FAQ,
gallery, admin, and mobile views of the live site. Used in the README
and for documentation purposes.

---

## Conventions

- Files in **English** unless they're translations of legal / regulatory
  material (the DPIA is bilingual by design).
- Markdown only (`.md`).
- Folder names are **lowercase-kebab-case**.
- Use [GitHub-flavored Markdown](https://github.github.com/gfm/).
- Sensitive details (org identity, codice fiscale, contact info) are
  redacted with `[redacted]` placeholders. Full versions stay on local
  storage only.