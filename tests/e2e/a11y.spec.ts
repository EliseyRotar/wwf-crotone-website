import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Axe-core WCAG 2 A/AA accessibility scans.
 *
 * For every top-level public page in the IT locale, we run the axe
 * analyzer and fail the build on any `wcag2a` or `wcag2aa` violation.
 * `wcag2aaa` is not enforced (the site isn't aiming for AAA and a lot
 * of legitimate patterns trip AAA rules).
 *
 * We intentionally skip /en because translation parity is covered
 * separately in src/i18n and a11y is a single-language concern. Add
 * /en scans here if a translation introduces new components.
 *
 * Tag: @a11y — slower than @smoke (axe runs a full DOM scan). Run on
 * PRs and before release.
 */

const PUBLIC_PAGES = [
  "/it",
  "/it/about",
  "/it/activities",
  "/it/dates",
  "/it/contact",
  "/it/faq",
  "/it/gallery",
  "/it/blog",
  "/it/support",
  "/it/privacy"
];

test.describe("accessibility (axe-core) @a11y", () => {
  for (const url of PUBLIC_PAGES) {
    test(`${url} has no WCAG2 A/AA violations`, async ({ page }) => {
      await page.goto(url);
      // Give the page a beat to hydrate so we scan the post-hydration DOM
      // (the toggle buttons / cookie banner / chat widget all mount
      // client-side).
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      if (results.violations.length > 0) {
        // Pretty-print the violations in the test output. The list also
        // ends up in the HTML report and on CI annotations.
        const summary = results.violations
          .map(
            (v) =>
              `  - ${v.id} (${v.impact}) — ${v.help}\n    nodes: ${v.nodes
                .map((n) => n.target.join(" "))
                .slice(0, 3)
                .join(", ")}`
          )
          .join("\n");
        throw new Error(`axe found ${results.violations.length} violation(s) on ${url}:\n${summary}`);
      }
    });
  }
});
