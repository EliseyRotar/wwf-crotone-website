import * as Sentry from "@sentry/nextjs";

/**
 * instrumentation-client.ts — Sentry SDK init for the browser.
 *
 * Wired up by Next.js automatically via src/instrumentation.ts. Loaded
 * once on the first page load and persists across navigations.
 *
 * Scope: errors + tracing + (optional) replay. We don't enable:
 *   - userFeedback (Brevo mail handles that)
 *   - logs (we use the browser console)
 *   - profiling (we ship few enough events that traces are enough)
 *
 * PII scrubbing: the beforeSend hook strips user info + extra fields
 * on any event that comes from the chat route (the only place
 * untrusted text enters the browser).
 *
 * DSN: env NEXT_PUBLIC_SENTRY_DSN (must be public-safe) or SENTRY_DSN.
 * The SDK is a no-op when both are empty — fine for local dev.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,

  // 10% in prod, 100% in dev. Adjust if we hit the free-tier limit.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  sendDefaultPii: false,

  beforeSend(event) {
    const tx = event.transaction ?? "";
    const url = event.request?.url ?? "";
    if (/chat/i.test(tx) || /\/api\/chat/.test(url)) {
      event.extra = undefined;
      if (event.user) {
        event.user.ip_address = undefined;
        event.user.email = undefined;
        event.user.username = undefined;
      }
    }
    return event;
  },
});

/**
 * Sentry v10: instrument client-side router navigations so the
 * "Traces" view shows route changes as spans. This is exported
 * separately so Sentry can hook it into the Next.js router.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
