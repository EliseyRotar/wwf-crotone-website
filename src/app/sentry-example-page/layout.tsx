/**
 * src/app/sentry-example-page/layout.tsx — minimal layout for the
 * Sentry smoke-test page.
 *
 * The page lives outside the [locale] segment (it's a dev-only
 * utility, no i18n needed) and outside the admin segment (no auth).
 * Therefore it needs its own minimal layout to satisfy Next.js's
 * "every page must have a root layout" rule.
 *
 * No HTML wrapper here — the page itself owns the `<html>` to keep
 * the smoke test independent of the rest of the app's DOM.
 */
export default function SentryExampleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
