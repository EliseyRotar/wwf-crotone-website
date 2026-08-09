# Security Policy

## Supported Versions

This project is volunteer-maintained and uses a rolling-release model —
we deploy from `main` as soon as changes are merged. Older versions
are not supported; if you're running a fork, please keep it current.

| Branch | Supported          |
|--------|--------------------|
| `main` | ✅ Always          |

## Reporting a Vulnerability

If you've found a security issue in this codebase or the live site at
[wwfcrotone.it](https://wwfcrotone.it), please report it privately.

**Email:** wwfcrotone26@gmail.com (Elisey R., technical maintainer)

Use this email — **do not open a public GitHub issue** for security
problems. A public issue tells attackers where to look.

### What to include

A good report has:

- A clear description of the issue and its impact
- Steps to reproduce (proof-of-concept code, screenshots, curl commands…)
- The affected version / commit hash
- Any known workarounds
- Your name / handle for the acknowledgement list (optional)

### What to expect

- **Initial acknowledgement:** within 72 hours
- **Triage + severity assessment:** within 7 days
- **Fix timeline:** depends on severity — critical (RCE, auth bypass,
  data breach) within days; high within 2-4 weeks; medium/low when
  next release cycle ships
- **Disclosure:** we coordinate disclosure timing with you. We aim to
  fix + release + disclose together rather than leaving you in limbo.

### Out of scope (please don't report)

- Lack of HTTPS / security headers that we know about and are tracking
  in public issues (check the issues tab)
- Theoretical attacks that require physical access to a volunteer's
  device
- Social engineering against WWF Crotone staff or volunteers
- Reports about the *content* of the site (typos, translations,
  accessibility of volunteer-facing copy) — those go in regular issues

## Security posture (what we already do)

- All HTTP responses include CSP, X-Frame-Options, HSTS, and other
  security headers (configured in `next.config.js` + `middleware.ts`)
- Admin routes geo-restricted at the nginx level (CF IP country must
  be IT, EU, EEA, CH, or GB)
- JWT session cookies are `HttpOnly`, `Secure` (prod), `SameSite=strict`
- Sessions are re-validated against the DB on every request (revoked
  accounts lose access immediately)
- All public API routes have rate limiting (in-memory + optional
  Upstash Redis for distributed limiting)
- AI chatbot has a typo-tolerant injection guard + Groq's
  prompt-guard-2 classifier
- All file uploads validated by magic bytes (not just MIME type)
- Sentry's `beforeSend` hook strips PII (request bodies, cookies,
  headers) for sensitive routes before sending
- Postgres backed up daily to Cloudflare R2 with WAL-G continuous
  archiving (weekly restore drill verifies backups work)
- Cloudflare in front: bot fight mode on, AI scrapers blocked,
  email routing with catch-all forward to verified inbox

## Acknowledgements

We thank everyone who reports vulnerabilities responsibly.

---

This file was last reviewed: see git log for `docs/SECURITY.md`.
EOF
EOF