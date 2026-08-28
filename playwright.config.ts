import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the WWF Crotone website E2E suite.
 *
 * Target environments:
 *   - Default:  http://localhost:3000  (npm start after `npm run build`)
 *   - Override: set BASE_URL=https://wwfcrotone.it npm run test:e2e:smoke
 *
 * The site uses `next-intl` locale routing with `/it/*` and `/en/*` as
 * the two public locales. Admin / API / asset routes skip the locale
 * rewrite (see src/middleware.ts). Tests that hit the public site must
 * include the locale prefix in the path; admin and API tests do not.
 *
 * Tests are tagged so we can run subsets in CI / locally:
 *   @smoke  — fast happy-path coverage, run on every PR
 *   @a11y   — axe-core WCAG 2 A/AA scans, slower (one per page)
 *   @admin  — admin panel (needs seeded DB and known creds)
 *   @slow   — slow tests (full magic-link flow, etc.) — off by default
 *   @critical — must-pass subset of @smoke for release gating
 *
 * Tag examples:
 *   npx playwright test --grep @smoke
 *   npx playwright test --grep "@smoke|@a11y"
 *   npx playwright test --grep-invert @slow
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  // Glob pattern — each spec file is picked up automatically; the
  // README/docs note uses (file naming is left to the writer).
  testMatch: /.*\.spec\.ts$/,

  // Default test timeout. A11y axe scans of pages with Leaflet maps
  // can take >30s on a cold dev server, so we leave headroom here.
  timeout: 60_000,

  // Per-test expectation timeout (default 5s). Bumped a bit so a slow
  // Leaflet tile fetch on /it/about doesn't flake the suite.
  expect: { timeout: 10_000 },

  // Run tests sequentially — we share a single SQLite dev DB and a
  // single Next.js dev server. Parallel workers will fight over the
  // in-memory rate-limit buckets and trip each other's tests. Once the
  // suite has a Postgres-backed test DB we can flip this back to fully
  // parallel.
  fullyParallel: false,
  workers: 1,

  // Forbid test.only — accidentally committing a `.only()` would skip
  // 90% of the suite on CI. We rely on the @smoke grep to pick subsets.
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,

  // Reporter: 'list' locally (colored output, easy to read), 'github'
  // in CI (annotates the PR with failures inline). `html` is always
  // produced so `npx playwright show-report` works after a run.
  reporter: IS_CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }]
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }]
      ],

  use: {
    baseURL: BASE_URL,
    // Reasonable defaults; overridden in the responsive spec.
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    // Trace on first retry so we can debug CI flakes without bloating
    // every run. Screenshots only on failure to keep artifacts small.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Default locale for the test browser; tests can override via
    // page.context().setExtraHTTPHeaders({ 'Accept-Language': ... })
    // when they need a specific language to drive middleware.
    locale: "it-IT",
    timezoneId: "Europe/Rome"
  },

  // Chromium-only for now. Webkit/Firefox add ~200MB of binaries and
  // aren't critical for this site (no Safari-specific CSS, no Gecko-only
  // APIs). When we need them, add projects: [{ name: 'webkit', use:
  // devices['Desktop Safari'] }, { name: 'firefox', use: devices['Desktop Firefox'] }].
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],

  // Auto-start the production server (`npm start` after `npm run build`)
  // for the test run. On developer machines we reuse an existing server
  // so multiple `playwright test` runs don't have to re-build.
  webServer: {
    command: "npm run build && npm start",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !IS_CI,
    stdout: "ignore",
    stderr: "pipe"
  }
});
