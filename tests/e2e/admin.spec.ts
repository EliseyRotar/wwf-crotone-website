import { test, expect } from "@playwright/test";

/**
 * Admin panel E2E coverage.
 *
 * We log in via the public /admin/login form with the seeded admin
 * credentials. The default seeded admin (see prisma/seed.ts) is:
 *   email:    admin@wwfcrotone.it
 *   password: WWFCrotone2026!
 *
 * If your local DB uses different creds, set:
 *   E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD as env vars.
 *
 * IMPORTANT — by default these tests run against
 * http://localhost:3000 (the dev DB). If you point BASE_URL at
 * https://wwfcrotone.it you'll hit the LIVE DB. Don't commit any test
 * data you create here.
 *
 * Tag: @admin
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@wwfcrotone.it";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "WWFCrotone2026!";

const ADMIN_ROUTES = [
  "/admin",
  "/admin/iscrizioni",
  "/admin/operatori",
  "/admin/turni",
  "/admin/blog",
  "/admin/gallery",
  "/admin/camp-settings",
  "/admin/status",
  "/admin/audit",
  "/admin/utenti",
  "/admin/roster"
];

test.describe("admin auth @admin @smoke", () => {
  test("unauthenticated /admin redirects to /admin/login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login flow lands on /admin", async ({ page, context, request }) => {
    // Preflight: if the DB is unreachable (CI without Postgres), skip
    // the whole admin suite. Otherwise the login would always fail
    // and we'd get noisy false positives.
    const health = await request.get("/api/health/db");
    if (health.status() !== 200) {
      test.skip(true, `/api/health/db returned ${health.status()} — DB unreachable, admin suite skipped`);
      return;
    }

    await context.clearCookies();
    await page.goto("/admin/login");

    // Sanity: the form is rendered. Scope locators to the <main>
    // because the page also has a newsletter signup form (in the
    // footer) that has its own submit button.
    const main = page.locator("main");
    await expect(main.locator("#email")).toBeVisible();
    await expect(main.locator("#pw")).toBeVisible();

    await main.locator("#email").fill(ADMIN_EMAIL);
    await main.locator("#pw").fill(ADMIN_PASSWORD);
    // Scope the click to the admin login card (its submit button
    // contains the "Accedi" / "Login" label, distinguishing it from
    // the newsletter "Iscrivimi" button in the footer).
    await main.locator('button[type="submit"]:has-text("Accedi"), button[type="submit"]:has-text("Login"), button[type="submit"]:has-text("Sign")').first().click();

    // Wait for the redirect to /admin (admin login page calls
    // router.push("/admin") on success). With a real DB this happens
    // almost instantly.
    await page.waitForURL(/\/admin($|\/)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("main, body").first()).toBeVisible();
  });
});

test.describe("admin pages reachable when authenticated @admin", () => {
  // Preflight: skip the whole describe if the DB is unreachable.
  test.beforeAll(async ({ request }) => {
    const health = await request.get("/api/health/db");
    if (health.status() !== 200) {
      test.skip(true, `/api/health/db returned ${health.status()} — DB unreachable, admin suite skipped`);
    }
  });

  // Log in once via beforeAll and share the storage state across tests
  // in this describe. Using test.use({ storageState }) instead would be
  // cleaner but requires an extra CLI step; for now we log in per test.
  // The suite is single-worker so the extra cost is small.
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin/login");
    const main = page.locator("main");
    await main.locator("#email").fill(ADMIN_EMAIL);
    await main.locator("#pw").fill(ADMIN_PASSWORD);
    await main.locator('button[type="submit"]:has-text("Accedi"), button[type="submit"]:has-text("Login"), button[type="submit"]:has-text("Sign")').first().click();
    // Wait for the redirect to /admin (only happens with a real DB).
    await page.waitForURL(/\/admin($|\/)/, { timeout: 15_000 });
  });

  for (const route of ADMIN_ROUTES) {
    test(`${route} loads without 500`, async ({ page }) => {
      const response = await page.goto(route);
      const status = response?.status() ?? 0;

      // Auth check: if we're not logged in (DB unreachable → login
      // failed), we'll be redirected to /admin/login. That's still a
      // 200 response on the login page, NOT a 5xx.
      const url = page.url();
      if (/\/admin\/login/.test(url)) {
        // Not authenticated — skip the per-route check but record the
        // reason. The unauthenticated-redirect test in the prior
        // describe already covers this path.
        test.skip(true, "not authenticated (DB unreachable in this env) — route check skipped");
        return;
      }

      // Authenticated path: must NOT 5xx. 4xx is OK (e.g. 404 if a
      // route was renamed).
      expect(status, `${route} returned ${status}`).toBeLessThan(500);

      // And the body should not be the Next.js error overlay.
      const bodyText = (await page.locator("body").innerText()).toLowerCase();
      expect(bodyText).not.toContain("unhandled runtime error");
    });
  }

  test("logout clears the session", async ({ page, context }) => {
    // Check we have a session cookie. If not (DB unreachable), skip.
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "wwf_admin_session");
    test.skip(!sessionCookie, "no admin session cookie — login likely failed (DB unreachable)");

    await page.request.post("/api/admin/logout");

    // After logout, /admin should redirect to /admin/login.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
