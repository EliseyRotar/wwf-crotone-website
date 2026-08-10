/**
 * src/sentry.edge.config.ts — Sentry SDK init for the Edge runtime.
 *
 * Used by src/middleware.ts (and other Edge routes). The middleware
 * is the only piece of ours that runs on the Edge, so most of the
 * instrumentation is the same as the server config but slightly
 * leaner (no localhost DB probes, no Node.js-only integrations).
 *
 * PII scrubbing mirrors src/sentry.server.config.ts.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  sendDefaultPii: false,

  beforeSend(event) {
    const url = event.request?.url ?? "";
    if (/chat/i.test(event.transaction ?? "") || /\/api\/chat/.test(url)) {
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
