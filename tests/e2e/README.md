# E2E Tests

Playwright + axe-core end-to-end coverage for the WWF Crotone website.

## Quick start

```bash
# First time only: install browsers (chromium only — saves ~200MB)
npx playwright install --with-deps chromium

# Run the full suite (defaults to @smoke + everything else not skipped)
npm run test:e2e

# Run only the fast smoke subset (recommended for PRs)
npm run test:e2e:smoke

# Run the accessibility (axe) suite
npm run test:e2e:a11y

# Open the HTML report after a run
npm run test:e2e:report

# Open the Playwright UI (great for debugging)
npm run test:e2e:ui

# Run in headed mode (watch the browser)
npm run test:e2e:headed
```

## Where the tests live

```
tests/e2e/
├── public.spec.ts        # All public pages × both locales — @smoke
├── dark-mode.spec.ts     # Theme toggle + persistence — @smoke
├── responsive.spec.ts    # Mobile / tablet / desktop screenshots — @smoke
├── a11y.spec.ts          # axe-core WCAG 2 A/AA scans — @a11y
├── error-pages.spec.ts   # 404 + Sentry test page — @smoke
├── seo.spec.ts           # sitemap.xml / robots.txt / manifest — @smoke
├── security.spec.ts      # CSP / XFO / XCTO / CSRF / admin auth — @smoke
├── admin.spec.ts         # Admin login + pages — @admin
├── admin-crud.spec.ts    # Admin panel full CRUD + auth flow — @admin
├── account.spec.ts       # Magic-link request-only smoke — @slow
├── magic-link.spec.ts    # Full magic-link E2E (needs Mailpit) — @magic-link @smoke
├── chatbot.spec.ts       # Chatbot rate-limit + CSRF — @chatbot
└── signup.spec.ts        # Booking form + receipt upload — @signup @receipts
```

## Tags

Tests are tagged so you can pick subsets:

| Tag       | What it runs                                  | Typical CI use |
|-----------|-----------------------------------------------|----------------|
| `@smoke`  | Happy-path coverage of every public page      | Every PR       |
| `@a11y`   | axe-core scans of public pages (slower)       | Every PR       |
| `@admin`  | Admin panel (needs seeded creds)              | Manual / nightly |
| `@slow`   | Slow tests (touches SMTP, full booking flow)  | Manual / nightly |
| `@critical` | Tightest smoke subset for release gating    | Pre-release    |

Combine with `playwright test --grep`:

```bash
# Smoke + a11y together
npx playwright test --grep "@smoke|@a11y"

# Everything except @slow
npx playwright test --grep-invert @slow
```

## Local vs CI configuration

By default tests hit `http://localhost:3000`. The Playwright config
auto-starts `npm run build && npm start` if no server is running (and
reuses an existing one on dev machines).

To target a different environment:

```bash
# Local dev server (already running, no rebuild)
BASE_URL=http://localhost:3000 npm run test:e2e:smoke

# Production (use with care — admin tests will hit the live DB)
BASE_URL=https://wwfcrotone.it npm run test:e2e:smoke

# Staging / preview URL
BASE_URL=https://staging.wwfcrotone.it npm run test:e2e:smoke
```

The `.env` file in this repo points at `localhost:3000` with the dev
SQLite DB. To test against a different DB (e.g. a Postgres test
container), point `DATABASE_URL` at it before starting the server.

## Test data conventions

- **Volunteer account email:** `e2e-test+<timestamp>@example.com` —
  append a unique suffix to avoid colliding with other CI runs.
- **Admin login:** seeded as `admin@wwfcrotone.it` /
  `WWFCrotone2026!` (see `prisma/seed.ts`). Override with
  `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` env vars if your DB
  differs.
- **Booking dates:** Don't hardcode turn IDs — they change between
  seasons. Either look them up via the DB or use `npm run db:studio`
  to find the current season.

## Adding a new test

1. Pick the right spec file (or create a new one under `tests/e2e/`).
2. Use the `test.describe` / `test()` pattern. Tag with `@smoke`,
   `@a11y`, `@admin`, or `@slow` as appropriate.
3. Use `getByRole`, `getByText`, `getByLabel` etc. — avoid brittle
   CSS selectors that depend on Tailwind class names.
4. Loosely match text — i18n keys can change between releases. A
   regex with the `i` flag is your friend.
5. If you add a new tag, document it in this README.

## Known limitations

- **Magic-link email verification** is covered end-to-end via
  `magic-link.spec.ts` when `MAILPIT_URL` is set. In CI, the
  `.github/workflows/ci.yml` E2E job starts `axllent/mailpit:latest`
  as a service container (ports 1025 SMTP + 8025 HTTP API). The test
  submits the magic-link request, polls Mailpit's REST API for the
  matching message, extracts the verification URL from the HTML body,
  and follows it in Playwright to assert the session cookie is set.
  Without `MAILPIT_URL` the test skips gracefully.
- **Visual regression** is screenshot-only — the responsive spec
  captures PNGs at three viewports but doesn't compare them. Wire up
  `expect(page).toHaveScreenshot()` once we have a stable baseline.
- **Webkit / Firefox** aren't covered. Add projects to
  `playwright.config.ts` when we need them.
- **Chatbot** at `/api/chat` is partially exercised — rate-limit + CSRF
  tests run without a real Groq key; the actual LLM response path
  needs `GROQ_API_KEY` and would burn quota on CI.

## Debugging

```bash
# Step through a test in slow motion
npx playwright test public.spec.ts --headed --debug

# Run a single test by name
npx playwright test -g "home loads with chrome"

# Re-run only failed tests
npx playwright test --last-failed

# Trace a specific run
npx playwright test --trace on
```

After a run, traces land in `test-results/` (gitignored) and the HTML
report in `playwright-report/`. Both are uploaded as artifacts on CI
failure.
