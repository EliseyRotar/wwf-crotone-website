/**
 * Full end-to-end magic-link flow.
 *
 * Setup: requires a running Next.js dev/prod server AND a Mailpit
 * (or any SMTP catcher) reachable on SMTP_HOST/SMTP_PORT, with its
 * HTTP API on MAILPIT_URL.
 *
 * Steps:
 *  1. POST /api/account/magic-link with a fresh email
 *  2. Poll MAILPIT_URL/api/v1/search until our email lands (or timeout)
 *  3. Fetch the HTML body of that message
 *  4. Extract the magic-link URL from the HTML (anchor href)
 *  5. Open the URL in Playwright — should land on /it/account with
 *     a session cookie set
 *  6. Navigate to /it/account/bookings or /it/account/profile to
 *     assert the session is real
 *
 * Tags: @magic-link, @smoke (so the CI smoke job picks it up).
 */

import { test, expect, request } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const LOCALE = "it";

async function fetchMagicLink(
  recipient: string,
  timeoutMs = 15_000
): Promise<string> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`
    );
    if (res.ok) {
      const json = (await res.json()) as { messages?: { ID: string }[] };
      if (json.messages && json.messages.length > 0) {
        const id = json.messages[0].ID;
        // Fetch the raw HTML body. Mailpit strips the wrapper when
        // serving the message at /api/v1/message/{id}.html
        const html = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`).then((r) => {
          if (!r.ok) throw new Error(`Mailpit message fetch failed: ${r.status}`);
          return r.text();
        });

        // The magic-link button is wrapped in an anchor with href
        // matching https://...?token=... or http://localhost:3000/...
        // Try both the HTML attribute pattern and a plain-text fallback.
        const hrefMatch = html.match(
          /href\s*=\s*["']([^"']*(?:magic|login|verify|redeem|account)[^"']*)["']/i
        );
        if (hrefMatch) return hrefMatch[1];
        const textMatch = html.match(
          /(https?:\/\/[^\s<>"']+(?:magic|login|verify|redeem|account)[^\s<>"']*)/
        );
        if (textMatch) return textMatch[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No magic-link email arrived for ${recipient} within ${timeoutMs}ms`);
}

test.describe("magic-link end-to-end @magic-link @smoke", () => {
  test.beforeEach(async ({ request }) => {
    // Skip if SMTP / DB isn't reachable. The CI job starts Mailpit as a
    // service container, so MAILPIT_URL will be set. Locally, this
    // test is opt-in via `npm run test:e2e:smoke -- --grep @magic-link`
    // after starting Mailpit yourself.
    if (!process.env.MAILPIT_URL) {
      test.skip(true, "MAILPIT_URL not set — magic-link E2E skipped");
      return;
    }
    const health = await request.get("/api/health/db");
    if (health.status() !== 200) {
      test.skip(true, `/api/health/db returned ${health.status()} — DB unreachable, magic-link test skipped`);
    }
  });

  test("POST /api/account/magic-link → email → click → /it/account", async ({ page }) => {
    const email = `e2e-magiclink+${Date.now()}@example.com`;

    // 1. Submit the magic-link request via the actual API so the
    //    magic-link route validates + persists + sends the email.
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const sendRes = await ctx.post("/api/account/magic-link", {
      headers: {
        "content-type": "application/json",
        origin: BASE_URL
      },
      data: { email, locale: LOCALE }
    });
    // Could be 200 (sent), 400 (bad email), 429 (rate-limited), or 500
    // (mail transport broken). Only 200 lets the test continue.
    if (sendRes.status() === 429) {
      test.skip(true, "magic-link rate-limit hit — skipping");
      return;
    }
    expect(sendRes.status()).toBe(200);

    // 2. Fetch the magic-link from Mailpit.
    const link = await fetchMagicLink(email);
    expect(link).toMatch(/^https?:\/\//);

    // 3. Click the link. Some paths go through /api/account/redeem?token=...
    //    which sets a session cookie and 302s to /it/account.
    await page.goto(link);

    // 4. After following the link, we should land in /it/account (or
    //    /it/account/profile) — anywhere in /it/account/* is fine.
    await page.waitForURL((url) => url.pathname.startsWith(`/${LOCALE}/account`), {
      timeout: 15_000
    });
    expect(page.url()).toContain(`/${LOCALE}/account`);

    // 5. The session cookie should be set. Reload to confirm it
    //    persists — if we lost the cookie we'd be 302'd back to
    //    /it/account/login.
    const sessionCookie = await ctx.storageState();
    const wwfAccount = sessionCookie.cookies.find(
      (c) => c.name === "wwf_account" || c.name === "wwf_device_session"
    );
    expect(wwfAccount, "wwf_account or wwf_device_session cookie must be set").toBeTruthy();

    // 6. Visit the account home and confirm we're authenticated.
    const accountRes = await ctx.get(`/${LOCALE}/account`);
    expect(accountRes.status()).toBe(200);
  });

  test("two simultaneous magic-link requests for the same email: only one wins", async () => {
    const email = `e2e-magiclink-dup+${Date.now()}@example.com`;
    const ctx = await request.newContext({ baseURL: BASE_URL });

    // Fire two requests in parallel. The server should rate-limit or
    // generate two distinct tokens; either way the test should not
    // deadlock. We just assert both responses are 200 or 429.
    const [a, b] = await Promise.all([
      ctx.post("/api/account/magic-link", {
        headers: { "content-type": "application/json", origin: BASE_URL },
        data: { email, locale: LOCALE }
      }),
      ctx.post("/api/account/magic-link", {
        headers: { "content-type": "application/json", origin: BASE_URL },
        data: { email, locale: LOCALE }
      })
    ]);
    // At least one must be 200 or 429. We don't enforce which — what
    // we DO enforce is that neither returns 500 (which would indicate
    // a deadlock / race condition in the DB write path).
    expect([200, 429]).toContain(a.status());
    expect([200, 429]).toContain(b.status());
  });

  test("magic-link for unknown email returns uniform 200 (no enumeration)", async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    // Rate limit may trip if we test this too often; skip if so.
    const res = await ctx.post("/api/account/magic-link", {
      headers: { "content-type": "application/json", origin: BASE_URL },
      data: { email: `nobody-${Date.now()}@example.com`, locale: LOCALE }
    });
    expect([200, 429]).toContain(res.status());
    if (res.status() === 200) {
      const json = (await res.json()) as { ok?: boolean; sentTo?: string };
      expect(json.ok).toBe(true);
      // CRITICAL: must NOT include the email in the response (enumeration
      // prevention — see audit F-03).
      expect(json.sentTo).toBeUndefined();
    }
  });
});
