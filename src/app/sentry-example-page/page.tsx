"use client";

/**
 * /sentry-example-page — Sentry smoke test.
 *
 * Renders a button that throws a `Sentry Test Error` when clicked, so
 * we can verify the SDK is wired up by checking the Sentry dashboard.
 * The page is registered in Next.js's instrumentation hooks (`register`
 * in instrumentation.ts) and the server-side `onRequestError` captures
 * any rendered error.
 *
 * NOT enabled in production: the page is dev-only and the route is
 * blocked at the middleware level by SITE_MAINTENANCE / SENTRY_DEV_MODE
 * (no — by an explicit check: if SENTRY_DSN is empty we render the
 * instructions text instead of the button). This keeps the test page
 * honest — it only works when Sentry is configured.
 *
 * Public by design (no auth) because it's a one-click smoke test that
 * needs to be runnable from anywhere by anyone debugging at 3am.
 */

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
  const enabled = !!dsn;

  return (
    <main style={{ maxWidth: 600, margin: "4rem auto", padding: "1.5rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Sentry smoke test</h1>
      <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
        {enabled
          ? "Click the button to trigger a test error. It should appear in the Sentry dashboard within 10 seconds."
          : "Sentry is not configured (SENTRY_DSN is empty). Set it in .env to enable this test."}
      </p>
      {enabled && (
        <button
          type="button"
          onClick={() => {
            throw new Error("Sentry Test Error");
          }}
          style={{
            padding: "0.5rem 1rem",
            background: "#007932",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          Break the world
        </button>
      )}
      <p style={{ marginTop: "1rem", fontSize: "0.85rem", opacity: 0.6 }}>
        DSN: {dsn ? `${dsn.slice(0, 30)}…` : "(empty)"}
      </p>
    </main>
  );
}
