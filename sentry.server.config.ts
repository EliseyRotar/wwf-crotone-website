/**
 * src/sentry.server.config.ts — server-side Sentry SDK init.
 *
 * Loaded by src/instrumentation.ts under NEXT_RUNTIME === "nodejs".
 *
 * Scope: errors + tracing only. We deliberately disable:
 *   - sessionReplay (server-side doesn't apply)
 *   - userFeedback (we use Brevo mail for that)
 *   - logs (we ship to stdout for Docker)
 *   - profiling (correlation to traces is enough)
 *
 * DSN: env SENTRY_DSN — leave empty in dev to disable Sentry entirely
 *      (the SDK is a no-op when dsn is empty).
 *
 * PII scrubbing: the existing instrumentation-client.ts already strips
 * `user.ip_address` etc. when the event URL matches /chat. We do the
 * same here on the server side because the chatbot backend runs in
 * Node.js and could surface user prompts in stack traces.
 *
 * Traces sample rate: 10% in prod, 100% in dev. We rarely hit the
 * 5k-event/month free tier limit because most errors are deduped
 * upstream.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,

  // 10% of transactions in prod, 100% in dev. Tune via env if we hit
  // the free tier limit.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Don't send PII by default. We never use Sentry's user-feedback
  // widget, so we don't need IP, email, or username.
  sendDefaultPii: false,

  beforeSend(event) {
    // H-17: scrub events from the chat route the same way the client
    // does. The chat widget is the only place untrusted user text
    // enters the server, so we drop any `extra` field that may carry
    // it.
    const url = event.request?.url ?? "";
    if (/chat/i.test(event.transaction ?? "") || /\/api\/chat/.test(url)) {
      event.extra = undefined;
      if (event.user) {
        event.user.ip_address = undefined;
        event.user.email = undefined;
        event.user.username = undefined;
      }
    }
    // Drop events that came from the crawl of our own tests / smoke
    // scripts (User-Agent h.crawl-* or HeadlessChrome).
    const ua = event.request?.headers?.["user-agent"] ?? "";
    if (/HeadlessChrome|uptime-robot|statuscake/i.test(ua)) {
      return null;
    }
    return event;
  },
});
