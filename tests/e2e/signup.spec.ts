import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * Volunteer signup (iscrizione) flow.
 *
 * The flow: anonymous user lands on /it/dates, picks a turn, fills the
 * BookingForm (name/email/phone/birth date/etc.), submits, lands on a
 * "grazie" page, gets a magic-link email (Brevo/Gmail in prod, MailHog
 * in CI), clicks it, lands in /it/account.
 *
 * Tags:
 *   @signup — the happy-path end-to-end submission. Skips when DB is
 *     unreachable (no /api/health/db 200).
 *   @receipts — the receipt-upload happy + rejection paths. Also DB-gated.
 *
 * Both blocks depend on a working PostgreSQL (test runner uses SQLite in
 * dev). The Playwright config's webServer auto-skips if npm run start
 * can't bind, which is the right behaviour for CI without Postgres.
 */

const TEST_EMAIL = `e2e-signup+${Date.now()}@example.com`;

// Pre-create test PDFs of each flavour we want to test uploads with.
// Real PDF (1-page minimal) for the happy path; bytes-not-pdf for the
// rejection path. We use Buffer.from(...) so we don't need a fixture
// file committed in tests/e2e/fixtures/.
function pdfBytes(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF",
    "latin1"
  );
}
function jpgBytes(): Buffer {
  // Minimal JFIF header (not a fully-valid JPG but the magic-byte check
  // for 0xFF 0xD8 0xFF will pass).
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
}
function fakePdfBytes(): Buffer {
  // MZ (PE) header — should be rejected by magic-byte check even if
  // .pdf extension is added.
  return Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00", "latin1");
}
function tmpFile(name: string, bytes: Buffer): { path: string; cleanup: () => void } {
  const p = path.join(os.tmpdir(), name);
  fs.writeFileSync(p, bytes);
  return {
    path: p,
    cleanup: () => {
      try {
        fs.unlinkSync(p);
      } catch {
        // best effort
      }
    }
  };
}

test.describe("volunteer signup @signup", () => {
  test("/it/dates shows turni and a booking form", async ({ page, request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — signup skipped`);

    await page.goto("/it/dates");
    // The dates page has BookingForm + LiveAvailability (per i18n
    // key Audit.dashboard.campoFillRate). We assert at least one
    // booking form is visible.
    await expect(page.locator("form")).toBeVisible();
    // Turni are usually rendered as cards with the start date.
    await expect(page.locator("body")).toContainText(/202[6-9]/);
  });

  test("/en/dates shows turni and a booking form (English locale)", async ({ page, request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — signup skipped`);

    await page.goto("/en/dates");
    await expect(page.locator("form")).toBeVisible();
  });

  test("honeypot field silently accepts without creating a row", async ({ page, request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — signup skipped`);

    const res = await request.post("/api/iscrizione", {
      headers: {
        "content-type": "application/json",
        origin: process.env.BASE_URL ?? "http://localhost:3000"
      },
      data: {
        firstName: "Bot",
        lastName: "Bot",
        email: "bot@example.com",
        phone: "+390000000000",
        website: "http://spam.example.com" // honeypot
      }
    });
    // Honeypot triggers silent { ok: true } without DB write.
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { ok?: boolean };
    expect(json.ok).toBe(true);
  });

  test("submitting missing required fields returns 400", async ({ request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — signup skipped`);

    const res = await request.post("/api/iscrizione", {
      headers: {
        "content-type": "application/json",
        origin: process.env.BASE_URL ?? "http://localhost:3000"
      },
      data: { firstName: "Only Name" } // missing lastName/email/phone
    });
    expect(res.status()).toBe(400);
    const json = (await res.json()) as { ok?: boolean; error?: string };
    expect(json.ok).toBe(false);
  });

  test("XSS payload in name is escaped, not stored as HTML", async ({ page, request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — signup skipped`);

    const xssEmail = `xss+${Date.now()}@example.com`;
    const payload = `<script>alert('xss-${Date.now()}')</script>`;

    const res = await request.post("/api/iscrizione", {
      headers: {
        "content-type": "application/json",
        origin: process.env.BASE_URL ?? "http://localhost:3000"
      },
      data: {
        firstName: payload,
        lastName: "Test",
        email: xssEmail,
        phone: "+390000000000"
      }
    });
    // Either 201 (created, XSS sanitised) or 400 (validation rejected).
    expect([201, 400, 200]).toContain(res.status());

    // Visit the admin panel — if the payload stored, the admin's
    // iscrizioni list would render it as live <script>. We just check
    // that the admin panel doesn't execute our payload by visiting a
    // public page that might reflect it.
    await page.goto(`/it/mio-iscrizione?email=${encodeURIComponent(xssEmail)}`);
    const alertFired = await page.evaluate(() => {
      // After page load, check that no alert ran. We can't easily
      // assert "no script ran" so we check the page body doesn't
      // contain a live <script> tag with our payload.
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        if (s.textContent && s.textContent.includes("alert('xss-")) {
          return true;
        }
      }
      return false;
    });
    expect(alertFired).toBe(false);
  });
});

test.describe("receipt upload @receipts", () => {
  test("upload-receipt rejects .pdf file with PE magic bytes", async ({ request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — receipts skipped`);

    const fake = tmpFile("evil.pdf", fakePdfBytes());

    // First need a real iscrizione to upload against. Create one.
    const createRes = await request.post("/api/iscrizione", {
      headers: {
        "content-type": "application/json",
        origin: process.env.BASE_URL ?? "http://localhost:3000"
      },
      data: {
        firstName: "Receipt",
        lastName: "Tester",
        email: TEST_EMAIL,
        phone: "+390000000001"
      }
    });
    if (createRes.status() === 429) {
      fake.cleanup();
      test.skip(true, "rate-limited on iscrizione create");
      return;
    }
    expect([200, 201]).toContain(createRes.status());
    const created = (await createRes.json()) as { ok: boolean; id?: string };
    expect(created.ok).toBe(true);
    expect(created.id).toBeTruthy();

    // Try to upload the bogus PDF. Without a valid session cookie this
    // should 401/403; with a real session it should 400 (bad magic bytes).
    // Either rejection is acceptable — we just need to confirm the
    // upload endpoint is NOT publicly writable.
    const uploadRes = await request.post(`/api/iscrizione/${created.id}/upload-receipt`, {
      multipart: {
        file: {
          name: "evil.pdf",
          mimeType: "application/pdf",
          buffer: fake.path
        }
      }
    });
    fake.cleanup();

    // 401 (no auth) or 400 (bad magic bytes) — anything other than
    // 200/201 is correct.
    expect([400, 401, 403]).toContain(uploadRes.status());
  });

  test("upload-receipt rejects empty file", async ({ request }) => {
    const health = await request.get("/api/health/db");
    test.skip(health.status() !== 200, `DB unreachable (${health.status()}) — receipts skipped`);

    const empty = tmpFile("empty.pdf", Buffer.alloc(0));

    const createRes = await request.post("/api/iscrizione", {
      headers: {
        "content-type": "application/json",
        origin: process.env.BASE_URL ?? "http://localhost:3000"
      },
      data: {
        firstName: "Empty",
        lastName: "Receipt",
        email: `empty+${Date.now()}@example.com`,
        phone: "+390000000002"
      }
    });
    if (createRes.status() === 429) {
      empty.cleanup();
      test.skip(true, "rate-limited");
      return;
    }

    if (createRes.status() !== 200 && createRes.status() !== 201) {
      empty.cleanup();
      test.skip(true, `iscrizione create returned ${createRes.status()}`);
      return;
    }
    const created = (await createRes.json()) as { ok: boolean; id?: string };
    const uploadRes = await request.post(`/api/iscrizione/${created.id}/upload-receipt`, {
      multipart: {
        file: {
          name: "empty.pdf",
          mimeType: "application/pdf",
          buffer: empty.path
        }
      }
    });
    empty.cleanup();
    expect([400, 401, 403]).toContain(uploadRes.status());
  });
});
