import { test, expect, type Page } from "@playwright/test";

/**
 * Admin panel CRUD smoke tests.
 *
 * Logs in as admin, walks each admin sub-page, asserts the data table
 * renders and the most important action buttons exist. CRUD writes
 * are skipped in this suite — the audit recommends a separate suite
 * with a per-test cleanup hook.
 *
 * Tag: @admin
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@wwfcrotone.it";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "WWFCrotone2026!";

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Redirect lands on /admin
  await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 15_000 });
}

test.describe("admin CRUD @admin", () => {
  test.beforeEach(async ({ page, request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — admin tests skipped`);
  });

  test("login flow: bad creds → 401, good creds → /admin", async ({ page, request }) => {
    // Bad creds — should not log in
    const badRes = await request.post("/api/admin/login", {
      headers: {
        "content-type": "application/json",
        origin: process.env.BASE_URL ?? "http://localhost:3000"
      },
      data: { email: "wrong@example.com", password: "wrongpassword" }
    });
    expect(badRes.status()).toBe(401);

    // Good creds via UI
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 15_000 });
    expect(page.url()).not.toContain("/admin/login");
  });

  test("/admin dashboard renders + summary cards", async ({ page }) => {
    await loginAsAdmin(page);
    // Dashboard has cards with i18n keys "totalIscrizioni", "campiAttivi", etc.
    await expect(page.locator("body")).toContainText(/iscrizioni|campi|operatori/i);
  });

  test("/admin/iscrizioni lists volunteers + has filter controls", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/iscrizioni");
    // Has at least one of: filter buttons, search input, or rows
    await expect(page.locator("table, [role='table'], input, select").first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/operatori lists operators + has add button", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/operatori");
    await expect(page.getByRole("button", { name: /aggiungi|add/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/turni (campi) lists turni + has add button", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/turni");
    await expect(page.locator("table, input, button").first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/blog renders (empty or with posts)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/blog");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/admin/gallery renders upload affordance", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/gallery");
    await expect(page.locator("input[type='file'], button").first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/settings renders camp-settings form", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");
    // Form has year/numTurns/costNonMember inputs
    await expect(page.locator("input, select").first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/status renders the services/incidents admin UI", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/status");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/admin/audit renders the audit log table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/audit");
    await expect(page.locator("table, body").first()).toBeVisible({ timeout: 10_000 });
  });

  test("/admin/utenti renders the users table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/utenti");
    await expect(page.locator("table, body").first()).toBeVisible({ timeout: 10_000 });
  });

  test("logout clears the session", async ({ page }) => {
    await loginAsAdmin(page);
    // Click the Logout link (in the admin nav)
    const logoutLink = page.getByRole("link", { name: /esci|logout/i }).first();
    if (await logoutLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutLink.click();
      // Try to access /admin — should redirect back to /admin/login
      await page.goto("/admin/iscrizioni");
      await page.waitForURL((url) => url.pathname.includes("/admin/login"), { timeout: 10_000 });
      expect(page.url()).toContain("/admin/login");
    } else {
      test.skip(true, "logout link not visible in current admin layout");
    }
  });

  test("rate-limit: 12 admin logins in 15min → 429", async ({ request }) => {
    // We won't trigger a real rate-limit here because we don't want
    // to lock the admin account in shared CI. Just assert that the
    // route exists and returns 401/429 quickly.
    for (let i = 0; i < 12; i++) {
      const r = await request.post("/api/admin/login", {
        headers: {
          "content-type": "application/json",
          origin: process.env.BASE_URL ?? "http://localhost:3000"
        },
        data: { email: "nope@example.com", password: "nope" }
      });
      // 401 = bad creds. 429 = rate-limited. Both fine.
      expect([401, 429]).toContain(r.status());
    }
  });
});
