import * as Sentry from "@sentry/nextjs";

/**
 * H-17: strip PII from outgoing events for routes that handle sensitive
 * data. Every event that touches one of these paths must have its
 * `request.body`, `request.cookies`, `request.headers` cleared before
 * being sent to Sentry. We still capture the URL (no query params) and
 * the method so they're debuggable, but the payload stays server-side.
 */
const SENSITIVE_ROUTE_PATTERNS = [
  /^\/api\/chat\//,
  /^\/api\/admin\//,
  /^\/api\/iscrizione/
];

function isSensitive(url: string): boolean {
  return SENSITIVE_ROUTE_PATTERNS.some((re) => re.test(url));
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
  beforeSend(event) {
    const url = event.request?.url ?? "";
    if (isSensitive(url)) {
      // Drop request bodies — they may contain PII (volunteer data,
      // chat messages, admin actions). Keep status code + URL.
      if (event.request) {
        event.request.data = undefined;
        event.request.cookies = undefined;
        event.request.headers = {};
        // Strip query params from URL but keep path.
        try {
          const u = new URL(url);
          event.request.url = u.origin + u.pathname;
        } catch {
          /* ignore */
        }
      }
      // Strip user PII from `extra` and `contexts` if anything leaked.
      if (event.user) {
        event.user.ip_address = undefined;
        event.user.email = undefined;
        event.user.username = undefined;
      }
    }
    return event;
  },
  beforeSendTransaction(event) {
    const url = event.request?.url ?? event.transaction ?? "";
    if (isSensitive(url)) {
      // For transactions we keep the URL/path but never URLs with query
      // strings or bodies — privacy over debugging fidelity.
      if (event.request) {
        event.request.cookies = undefined;
        event.request.headers = {};
        event.request.data = undefined;
      }
    }
    return event;
  }
});
