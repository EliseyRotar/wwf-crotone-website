import { test, expect } from "@playwright/test";

/**
 * Dark-mode smoke test.
 *
 * The site stores the theme in TWO places:
 *   1. The `theme` cookie (set server-side in src/app/layout.tsx, used
 *      to avoid a flash of light theme on first paint).
 *   2. localStorage key "theme" — set by the inline hydration script
 *      on every page load.
 *
 * There is currently NO in-header toggle button — the only way to
 * switch is by setting `theme=dark` / `theme=light` directly (the
 * theme cookie is read on every page load, and the inline script
 * applies it client-side). We test this mechanism end-to-end:
 *
 *   1. Visit the home page with no theme set → light mode.
 *   2. Visit again with the theme=dark cookie → dark mode applied.
 *   3. Reload, verify the preference persists across navigations.
 */

test.describe("dark mode @smoke", () => {
  test("theme cookie flips html.dark and persists across reloads", async ({ page, context }) => {
    // 1. Light mode by default (no cookie).
    await context.clearCookies();
    await page.goto("/it");
    await expect(page.locator("header").first()).toBeVisible();

    const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
    const cookieTheme = () => page.evaluate(() => document.cookie.match(/theme=(dark|light)/)?.[1] ?? null);

    const lightCookie = await cookieTheme();
    const lightDark = await isDark();
    test.info().annotations.push({
      type: "dark-mode-default",
      description: `cookie=${lightCookie} isDark=${lightDark}`
    });

    // Screenshot for visual evidence.
    await page.screenshot({ path: "test-results/dark-mode-light.png", fullPage: false });

    // 2. Set the theme=dark cookie and reload — should flip html.dark.
    await context.addCookies([
      {
        name: "theme",
        value: "dark",
        domain: "localhost",
        path: "/"
      }
    ]);
    await page.reload();

    await expect.poll(isDark, { timeout: 5_000 }).toBe(true);
    await page.screenshot({ path: "test-results/dark-mode-dark.png", fullPage: false });

    // 3. Reload again — preference persists (it's now in the cookie).
    await page.reload();
    await expect.poll(isDark, { timeout: 5_000 }).toBe(true);

    // 4. Flip back to light.
    await context.addCookies([
      {
        name: "theme",
        value: "light",
        domain: "localhost",
        path: "/"
      }
    ]);
    await page.reload();
    await expect.poll(isDark, { timeout: 5_000 }).toBe(false);
  });
});
