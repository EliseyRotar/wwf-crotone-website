import { test, expect } from "@playwright/test";

/**
 * Responsive screenshots — visual regression baseline.
 *
 * Captures a full-page screenshot at three viewports (375 mobile,
 * 768 tablet, 1280 desktop) for the four most critical public pages.
 * The PNGs land in test-results/ and are NOT compared yet — they're
 * a baseline. Wire up `expect(page).toHaveScreenshot()` once the suite
 * is stable and a few rounds of "update snapshots" have been run.
 *
 * Tag: @smoke (no special tag — every PR should run this so we catch
 * obvious layout regressions).
 */

const PAGES = [
  { locale: "it", path: "" },
  { locale: "it", path: "activities" },
  { locale: "it", path: "dates" },
  { locale: "it", path: "contact" }
] as const;

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 720 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 }
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`responsive @ ${vp.name} @smoke`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const p of PAGES) {
      test(`${p.path || "/"} renders at ${vp.name}`, async ({ page }) => {
        const url = `/${p.locale}/${p.path}`;
        const response = await page.goto(url);
        expect(response?.status()).toBe(200);

        // Shared chrome.
        await expect(page.locator("header")).toBeVisible();
        await expect(page.locator("footer")).toBeVisible();

        // The header is fixed-height on desktop; we don't assert that
        // here because the SCSS-controlled header height changes on
        // mobile. Just make sure it's visible and not overflowing.
        const headerBox = await page.locator("header").boundingBox();
        expect(headerBox?.width).toBeLessThanOrEqual(vp.width + 1);

        // Screenshot the whole page — fullPage=true scrolls and stitches.
        const slug = p.path || "home";
        await page.screenshot({
          path: `test-results/responsive/${vp.name}-${p.locale}-${slug}.png`,
          fullPage: true
        });
      });
    }
  });
}
