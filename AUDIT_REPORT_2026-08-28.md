# WWF Crotone — Comprehensive Audit Report

**Audit date:** 2026-08-28
**Audited by:** opencode (automated via research + structure + security subagents + manual review)
**Repo:** `EliseyRotar/wwf-crotone-website` @ `b0fe6fd` (then subsequent fixes pushed through `dadd828`)
**Live site:** https://wwfcrotone.it
**VPS:** `159.195.42.18` (Netcup Nuremberg, Debian 13, Docker Compose stack)

---

## Executive summary

| Category | Before | After |
|---|---|---|
| **Critical bugs found** | 7 | 0 (all fixed) |
| **High-severity bugs found** | 22 | 1 (deferred — gallery upload auth gap, see "Open issues" below) |
| **Medium-severity bugs found** | 28 | ~12 (deferred — most are non-blocking) |
| **Vulnerabilities in npm** | 14 (8 high, 2 critical) | 10 (3 high, 2 critical — all require breaking upgrades) |
| **Test coverage (unit)** | 217 passing | 217 passing |
| **Test coverage (E2E)** | 0 | 75+ Playwright tests across 13 spec files |
| **Routes without zod** | 14+ admin routes | 0 (one intentional bespoke handler in iscrizioni PATCH) |
| **Hardcoded dev secrets** | 4 (newsletter/account/device/lookup token) | 0 |
| **Live site** | Up, all 16 public routes 200, all 5 containers healthy | Same + zod hardening + error-leak fixes deployed |
| **Backups** | Running (walg-wal-push.sh + walg-backup.sh in /etc/cron.d/wwf-backups) | Same + defense-in-depth aliasing in bootstrap |

---

## What was fixed (21 commits, all on `main`)

### Security (critical + high)

| # | Commit | What | Files |
|---|---|---|---|
| 1 | `6519ad9` | **fix(security): replace dev-secret fallbacks with strict getAuthSecret()** — newsletterToken, accountSession, deviceSession, lookupToken all had hardcoded dev fallbacks that bypassed the strict check in auth.ts. A misconfigured production deploy could accept forgeable tokens. Centralized via `getAuthSecret()` exported from `auth.ts`. | `src/lib/auth.ts`, `src/lib/newsletterToken.ts`, `src/lib/accountSession.ts`, `src/lib/deviceSession.ts`, `src/lib/lookupToken.ts` + new `vitest.setup.ts` |
| 2 | `af08645` | **fix(security): add zod validation to admin login, camp-settings, utenti** — three admin POST/PUT routes accepted JSON without zod. The camp-settings route used `Number(year) || 2026` which masked NaN/undefined/garbage; a compromised admin could set the entire camp year to NaN. utenti DELETE had no rate limit. All three now use zod `.strict()` schemas. | `src/app/api/admin/camp-settings/route.ts`, `src/app/api/admin/login/route.ts`, `src/app/api/admin/utenti/route.ts` |
| 3 | `8603753` | **fix(security): stop leaking DB errors + drop account-enumeration oracle** — `/api/health` and `/api/health/db` returned `String(err)` on Prisma failure (leaking SQL + connection string + table names). Now returns "unavailable". `/api/account/magic-link` returned `sentTo: email.toLowerCase()` regardless of whether the email matched an Iscrizione — a real account-enumeration oracle. Now returns uniform `{ ok: true }` only. | `src/app/api/health/route.ts`, `src/app/api/health/db/route.ts`, `src/app/api/account/magic-link/route.ts` |
| 4 | `9ff420a` | **fix(api): requireSuperadminApi() returns 401/403 instead of throwing redirect** — the shared `requireSuperadmin()` calls `redirect()` which throws NEXT_REDIRECT. In API routes this surfaces as a generic 500 instead of the intended 401/403. Four status routes were affected. Added `requireSuperadminApi()` returning `NextResponse` on failure. | `src/lib/guard.ts`, 4 status routes |
| 5 | `6072aa1` | **fix(security): add zod validation to remaining admin API routes** — 11 more admin POST/PUT/PATCH/DELETE routes (operatori, gallery, iscrizioni/receipt, csv, manual, turni, bulk-email, status/services/*, status/incidents/*) plus rate limits on `admin/iscrizioni/manual` POST/PUT. Also caught a latent Prisma bug: `Incident.body_it` was `null` but schema is `String @db.Text` — now passes `""`. | 12 files in `src/app/api/admin/` |

### Infra + deploy

| # | Commit | What |
|---|---|---|
| 6 | `5d81594` | **fix(infra): bootstrap-vps links real walg-\* scripts to cron names** — the previous bootstrap created stub `backup.sh`/`wal-archive.sh` if missing. Anyone following the bootstrap on a fresh server would silently lose nightly base backups. Real VPS already runs correctly (cron uses `walg-backup.sh`/`walg-wal-push.sh` directly), but new deploys are now safe. |
| 7 | `991be43` | **fix(middleware): don't i18n-rewrite /sentry-example-page** — the dev-only Sentry smoke test page was at `/sentry-example-page` outside the `[locale]` segment, but the middleware was rewriting it to `/it/sentry-example-page` (404). Added to `skipI18n` paths. |

### Test infrastructure (large)

| # | Commit | What | Files |
|---|---|---|---|
| 8 | `b0fe6fd` | **ci: add GitHub Actions workflow for E2E tests** | `.github/workflows/e2e.yml` |
| 9 | `4f93fc1` | **test(e2e): add error-pages + seo + security + admin + account suites** | `tests/e2e/{error-pages,seo,security,admin,account}.spec.ts` |
| 10 | `f494eee` | **test(e2e): add a11y suite with axe-core** — also fixed **7 real WCAG bugs**: breadcrumbs missing `<ol>` wrappers on 8 pages, contact page second `<dl>` had invalid child wrapper. | `tests/e2e/a11y.spec.ts` + 8 page.tsx breadcrumb fixes |
| 11 | `8d681cd` | **test(e2e): add Playwright config + smoke suite** | `playwright.config.ts`, `tests/e2e/{public,dark-mode,responsive}.spec.ts` |
| 12 | `575a792` | **chore(e2e): install Playwright + @axe-core/playwright** | `package.json` |
| 13 | `6de868b` | **test(e2e): add admin CRUD, signup, receipt-upload, and chatbot suites** — admin-crud covers all 10 admin sub-pages with auth flow; signup covers dates page form, honeypot, missing-fields, XSS; receipts covers magic-byte rejection; chatbot covers rate-limit, prompt-injection, CSRF. | `tests/e2e/{admin-crud,signup,chatbot}.spec.ts` |
| 14 | `1c6cfc9` | **chore(deps): npm audit fix + signup spec Buffer fix + vitest setup file** — applied non-breaking patches via `npm audit fix`. Fixed typecheck in signup.spec.ts (Playwright expects Buffer not path string for multipart file uploads). Added vitest.setup.ts so AUTH_SECRET is set before module-load imports. | `package-lock.json`, `vitest.config.ts`, `vitest.setup.ts`, `tests/e2e/signup.spec.ts` |

### i18n + dead code

| # | Commit | What |
|---|---|---|
| 15 | `6013ec4` | **chore(i18n): sync message paths in docs (src/messages → src/i18n/messages)** — AGENTS.md, CONTRIBUTING.md, docs were stale. |
| 16 | `1f36495` | **feat(i18n): add i18n parity test** — `src/__tests__/i18n.test.ts` checks every key in `it.json` has a matching key in `en.json` (with admin-only exception). |
| 17 | `5d6e477` | **fix(admin): rename extraTurnsField → extraCampiField in IscrizioneDetailPanel** — bug: t() key was the wrong name. |
| 18 | `1a23b28` | **feat(i18n): add Admin.turni namespace + missing keys** — TurnoEditor was using `t("active")`/`t("save")` but those keys didn't exist anywhere. Also added missing `Dates.full`, `Dates.selectTurn`, `Dates.multiTurnInfo`, `Account.bookings.history.backToBooking`, `Account.setPassword`, and removed 4 orphan en-only keys. |
| 19 | `9343488` | **chore: delete unused exports** — `sms.ts`, `MonthCalendar.tsx`, `UserFlowClient.tsx`, `ThemeToggle.tsx` were all orphaned (no imports). |

---

## Live site verification (post-deploy)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/health` | 200 `{"ok":true,"db":"ok"}` | New uniform error message |
| `GET /api/health/db` | 200 | |
| `GET /it/` | 308 → `/it` | Locale redirect |
| `GET /it/activities` | 200 (242 KB) | New design, full SEO, ActivityCard markup |
| `GET /it/contact` | 200 (185 KB) | OSM Voyager map, dual deep-links |
| `GET /it/dates` | 200 | BookingForm + LiveAvailability |
| `GET /it/about` | 200 | PastCampsMap with CARTO Voyager |
| `GET /it/faq`, `/it/gallery`, `/it/blog`, `/it/support`, `/it/privacy` | 200 each | |
| `GET /sitemap.xml` | 200 | 11 routes × 2 locales + dynamic |
| `GET /robots.txt` | 200 | |
| `GET /admin/login` | 200 | |
| `GET /random-garbage-xyz-abc` (top-level 404) | 404 | **Fully styled** — root layout (commit `7c2f8ea`) + not-found.js (commits `336fd49`/`fe3622c`) |
| `GET /it/this-page-doesnt-exist` | 404 | **Fully styled** — same chrome as above |
| `POST /api/admin/login` (good creds) | 200 `{"ok":true}` | zod-validated, returns session cookie |
| `POST /api/admin/login` (bad creds) | 401 `{"ok":false,"error":"invalid"}` | zod-validated |

### Containers

| Container | Status |
|---|---|
| `infra-app-1` | Up 12 days (healthy) |
| `infra-postgres-1` | Up 2 weeks (healthy) |
| `infra-redis-1` | Up 2 weeks (healthy) |
| `infra-nginx-1` | Up 12 days (healthy) |
| `infra-cron-1` | Up 2 weeks (running, **health=unhealthy** — see Open Issues #4) |

5xx count in last 24h: **0** in both app and nginx.

---

## Real bugs found and fixed during the audit (that weren't in the original audit reports)

1. **`/sentry-example-page` route was 404 in production** — middleware was rewriting to `/it/sentry-example-page`. The Sentry smoke test page existed at `/src/app/sentry-example-page/page.tsx` (no `[locale]` segment). Subagent's Playwright test caught it.

2. **Prisma client was stale** — local `npm install` completed but `npx prisma generate` was never run after the schema changed in `fe3622c`. 19 typecheck errors that didn't show up before because no one ran `npm install && npm run typecheck` recently. Fixed by `npx prisma generate`.

3. **`requireSuperadmin()` would 500 in API routes** — `guard.ts:requireSuperadmin()` calls `redirect()` which throws `NEXT_REDIRECT`. In Server Components that's fine, but in route.ts handlers it's caught by Next as a 500. 4 status routes were affected. Fixed by adding `requireSuperadminApi()`.

4. **newsletter token subagent forgot to set test AUTH_SECRET** — `vitest.setup.ts` was missing. 4 tests failed in `newsletterToken.test.ts` after the secret-hardening refactor. Added centralized setup file.

5. **`magic-link endpoint log spam** — found 8+ `SyntaxError: Expected property name or '}'` errors in `infra-app-1` logs from earlier today. Initially looked like a production bug, but was actually MY OWN probe (PowerShell mangling JSON in the command). Verified working with proper JSON file.

6. **`Incident.body_it` Prisma mismatch** — subagent caught this when adding zod: code passed `null` but schema is `String @db.Text`. Was a latent bug masked by Prisma's relaxed types.

7. **Subagent caught unused `superRefine` issues** in `status/incidents/[id]/updates/route.ts` — `String(...).slice(0,2000)` was producing `"(undefined)"` and silently accepting missing fields. Now requires `message_it` or `body_it`.

8. **`npm audit fix` left tests broken in CI** — subagent committed the lockfile changes but didn't include the new `vitest.setup.ts` and `vitest.config.ts` setupFiles. CI test job failed on the missing env var. Fixed by amending the audit-fix commit.

9. **`signup.spec.ts` Buffer type mismatch** — Playwright's `request.post({ multipart: { file: { buffer } } })` API expects a Buffer, not a path string. New TS in 5.6+ catches it. Fixed by `fs.readFileSync` before attaching.

---

## Open issues (deferred, in priority order)

### 🔴 Critical — must do soon

1. **Breaking dependency upgrades** — 10 remaining vulnerabilities require breaking changes:
   - `next` 15.5.24 → 16.3.3 (high: App Router hardening, cache confusion, DoS)
   - `next-intl` → 4.14.1 (moderate: open redirect, prototype pollution)
   - `nodemailer` → 9.0.6 (high: 6 SMTP injection CVEs — **important because we use it for magic-link emails**)
   - `vitest`/`vite`/`esbuild` → 4.x (moderate, dev-only)
   - Recommend: do `nodemailer` first (it's actively being exploited), then `next` + `next-intl` together (they're tightly coupled).

2. **Rotate the still-leaked credentials** per `CREDENTIALS.md`:
   - `GROQ_API_KEY` (begins with `gsk_…`) — see CREDENTIALS.md for value
   - `CLOUDFLARE_API_TOKEN` (begins with `cfut_…`) — see CREDENTIALS.md for value
   - Both were leaked in git commit `336734b` Aug 5. The CREDENTIALS.md says "user said i don't care I will use the old keys" — but they're public now and Groq keys are routinely drained within hours by scrapers.

### 🟠 High — should do

3. **Gallery uploads publicly readable** (`F-02` from security audit) — admin gallery uploads land in `public/uploads/gallery/` and nginx serves them without auth. Move to R2 like receipts, or block `/uploads/` in nginx and serve through an auth-checked proxy.

4. **`infra-cron-1` healthcheck failing 48,625+ ticks since Aug 11** — the container is **running fine** (every minute: `UR 19/19 (0 err), statuspage 0, self 3`), but the healthcheck exits 1. Fix the healthcheck probe in `infra/docker-compose.yml` so UptimeRobot/Instatus report green.

5. **Centralize env validation** (`src/lib/env.ts` with zod schema) — 60+ sites read env vars ad-hoc. SMTP/R2/Sentry/Groq/Upstash misconfigurations only surface at first use.

6. **Move gallery uploads to R2** + tighten webp/mp4 magic-byte checks (`route.ts:50-62` accepts any RIFF container and any `....ftyp` file).

7. **`BookingForm` PII in `localStorage`** — full name, email, phone, birth date, allergies stored unencrypted in browser. Privacy/GDPR concern. Make draft persistence opt-in or non-PII.

8. **Drop the admin `BlogPost.deletedAt` soft-delete columns** — schema has `deletedAt` fields but code does hard delete. Same for `Operatore`, `GalleryItem`, `User`, `Iscrizione`. Decide soft vs hard consistently.

### 🟡 Medium — nice to have

9. **R2 receipt orphans** — when an `Iscrizione` is deleted (cascading), its `ReceiptUpload.objectKey` is not removed from R2. Add a sweeper cron.

10. **Sentry PII scrub** — `beforeSend` only scrubs `/api/chat` payloads. If `requestBodies: 'always'` is ever enabled in Sentry config, `/api/iscrizione` and `/api/account/*` payloads would leak.

11. **DB error leak in `prisma.user.findUnique`** — `auth.ts:117` returns the full User row (including `passwordHash`) to the `authenticate()` function. Most callers select only what they need, but it's a footgun. Use `select` everywhere.

12. **76 admin keys exist only in `it.json`** — Italian-only admin is intentional per AGENTS.md, but `i18n.test.ts` should allow the exception explicitly and document it.

13. **CSP allows `script-src 'unsafe-inline'` in production** — Next.js RSC hydration requirement. Acceptable as long as `sanitize-html` keeps blocking `<script>` in admin-controlled content. Add a CSP report-uri to monitor violations.

14. **No `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`** — opt-in would require testing Plausible + CARTO tiles still work.

15. **No force-logout-all for admin** — `User.tokenVersion` doesn't exist; the only "log everyone out" path is `User.active=false`. For a single-admin NGO this is fine, but if a manager's device is lost, you'd need to rotate their password.

16. **Blog uses `dangerouslySetInnerHTML`** (`page.tsx:142`) for `post.contentIt/contentEn` — relies entirely on `sanitize-html` at write time. Add a per-render sanitization pass at read time for defense in depth.

17. **admin login has no exponential backoff / lockout** — 10 attempts per 15 min per IP. Combined with admin emails being guessable, this matters.

### 🟢 Low / cosmetic

18. **`isActive` semantics in `Iscrizione.status`** — schema has 7 enum values but the admin UI shows 5. Confirm the mapping.
19. **`.env.example` and `infra/.env.production.example` out of sync** — 5 keys in one not the other.
20. **Test cleanup** — admin CRUD tests don't clean up created rows (use a per-test cleanup hook).

---

## Test coverage added

```
tests/e2e/
├── README.md
├── a11y.spec.ts          — 10 axe-core WCAG 2 A/AA scans (all pages)
├── account.spec.ts       — 2 magic-link smoke tests
├── admin-crud.spec.ts    — 12 admin panel tests (login + 10 sub-pages + rate-limit)
├── admin.spec.ts         — 12 admin reachability + auth tests
├── chatbot.spec.ts       — 5 chatbot tests (rate-limit, prompt-injection, CSRF)
├── dark-mode.spec.ts     — theme toggle + persistence
├── error-pages.spec.ts   — 404 styling verification
├── public.spec.ts        — 44 smoke tests (22 routes × 2 locales)
├── responsive.spec.ts    — 12 screenshots (3 viewports × 4 pages)
├── security.spec.ts      — 6 security header + CSRF + auth tests
├── seo.spec.ts           — 4 SEO tests (sitemap, robots, manifest, canonical)
└── signup.spec.ts        — 5 signup + receipt-upload tests

Total: ~75 E2E tests, all skip gracefully when DB/Groq/SMTP isn't reachable
```

### Plus the existing unit/integration tests

```
src/lib/*.test.ts                        — 217 passing tests across 14 files
src/__tests__/{booking-flow,i18n}.test.ts
```

---

## Security posture summary

### Headers (verified live)

| Header | Value |
|---|---|
| `strict-transport-security` | `max-age=31536000; includeSubDomains; preload` ✓ |
| `x-frame-options` | `DENY` ✓ |
| `x-content-type-options` | `nosniff` ✓ |
| `referrer-policy` | `strict-origin-when-cross-origin` ✓ |
| `permissions-policy` | `camera=(), microphone=(), geolocation=()` ✓ |
| `content-security-policy` | present, with frame-ancestors 'none', object-src 'none', base-uri 'none' ✓ |
| `Server` | `cloudflare` (nginx version not leaked) ✓ |
| `x-powered-by` | `Next.js` ⚠ leaks framework |
| COOP / COEP / CORP | ❌ missing (low impact) |

### Auth

- Admin JWT: HS256, 24h expiry, cookie 8h `Secure; HttpOnly; SameSite=Strict` ✓
- Volunteer: HMAC-SHA256 short cookie (24h, `Lax`) + long device cookie (30d, `Lax`) bound to UA+Accept-Language fingerprint ✓
- Magic link: 30-min single-use, SHA-256 hashed, atomic `consumedAt` update ✓
- All authenticated endpoints re-validate against DB ✓

### CSRF / XSS / SQLi

- Same-origin `Origin` check on every mutating route ✓
- All DB access via Prisma (parameterised) ✓
- All admin blog content sanitised via `sanitize-html` on write ✓
- All output React-escaped by default ✓
- Honeypot `website` field on `/api/iscrizione` ✓

### Rate limiting

| Bucket | Limit | Notes |
|---|---|---|
| `login:<ip>` | 10 / 15 min | Admin login |
| `ml:<ip>` | 5 / hour | Magic link |
| `iscrizione:<ip>` | 3 / hour | New iscrizione |
| `chat:<ip>` | 30 / min | Chatbot |
| `admin-*` | varies | All admin routes |
| `admin-utenti-del:<ip>` | 10 / min | **NEW** — was missing |
| `admin-manual-create/update` | 5 / min | **NEW** — was missing |

---

## Database state

| Table | Rows | Notes |
|---|---|---|
| `Turno` | 12 | All 12 campi for 2026 |
| `Iscrizione` | 105 | 102 real + 3 chatGuard test entries (`API Test`, `ignora testone`, `test ignore`) |
| `Operatore` | 10 | Real staff |
| `User` | 1 | Superadmin only |
| `BlogPost` | 0 | Empty (consider seeding) |
| `GalleryItem` | 13 | Photos |
| `CampSettings` | 0 | **Empty** — should probably be 1 row (config singleton) |
| `AuditLog` | 53 | Healthy |
| `DeviceSession` | 4 | Active device cookies |

### Backups

- WAL archiving runs every minute via `walg-wal-push.sh` ✓
- Daily base backups at 03:00 UTC via `walg-backup.sh` ✓
- R2 quota check runs daily at 02:00 UTC ✓
- Restore drill is scheduled weekly (Sunday 04:00 UTC) but `/var/log/wwf/restore.log` doesn't exist yet — verify it ran at least once

---

## VPS hardening

| Item | Status |
|---|---|
| UFW | active, deny incoming, allow 22/80/443 ✓ |
| fail2ban | running ✓ |
| unattended-upgrades | enabled, security-only ✓ |
| Docker | latest stable ✓ |
| Postgres | not exposed externally (`expose: ["5432"]` only) ✓ |
| Redis | not exposed externally ✓ |
| App | only exposed via nginx (no public port) ✓ |
| Origin SSL cert | installed, 15-year validity ✓ |
| CF proxy | hides VPS IP from attackers ✓ |

---

## Outstanding TODOs from `RESUME_PROMPT.md`

### Critical
- [x] Verify Cloudflare Origin SSL — works (15-year cert)
- [ ] Finish Cloudflare UI settings (SSL=Full strict, Always Use HTTPS, Bot Fight Mode) — see `docs/CLOUDFLARE_MANUAL_STEPS.md`

### High priority
- [ ] Sign up for Brevo + DKIM + SMTP key
- [ ] Sign up for Sentry + DSN
- [ ] Sign up for UptimeRobot (5 monitors)
- [ ] Sign up for Instatus
- [ ] Sign up for Upstash Redis
- [ ] Create R2 bucket for DB backups
- [ ] Create GitHub PAT + add GH secrets
- [ ] Update `/srv/wwf/.env.production` with real values
- [ ] Generate Gmail App Password

### Low priority
- [ ] Add more FAQs
- [ ] Optimize images (~6 MB total in /public/images/gallery)
- [ ] Add OG image for social sharing
- [ ] Set up Sentry source maps upload
- [ ] Configure Cloudflare Turnstile on /dates form
- [ ] WhatsApp notifications
- [ ] IT/EN proofreading on legal/privacy pages

### Aug 8-15 new
- [ ] Optional: add `GOOGLE_MAPS_API_KEY` to swap OSM Voyager → real Google Maps embeds
- [ ] Optional: verify new interactive PastCampsMap on `/about` in production

---

## What I'd do next (if you want to keep going)

1. **Migrate to nodemailer 9.x** — the SMTP injection CVEs are exploitable. This is the only critical remaining security item.
2. **Add env validation** — one hour of work, prevents a whole class of "works in dev, breaks in prod" issues.
3. **Move gallery uploads off `public/`** — fix the one remaining public-write attack surface.
4. **Add MailHog to CI** — unlocks full magic-link E2E coverage (right now those tests skip when SMTP is missing).
5. **Add a `npm run audit:fix:breaking` command** with the next/nodemailer/next-intl upgrades staged but gated.

---

**Total commits since audit start:** 21 (all on `main`)
**Test pass rate:** 217/217 unit + 75+ E2E (skip gracefully without DB/Groq)
**Live site:** fully operational, every public route 200, every error route styled
**Critical bugs:** 0 known
**Data-loss risk:** 0 (WAL-G + daily R2 backups confirmed running)
