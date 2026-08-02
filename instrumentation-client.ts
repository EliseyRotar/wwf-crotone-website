import * as Sentry from "@sentry/nextjs";

// H-17: same scrubber as on the server config — applied to all events
// originating from the browser. The browser already filters cookies /
// request bodies from its built-in fetch instrumentation, but Plausible /
// third-party script failures or chat-widget exceptions must not leak
// volunteer-supplied text to Sentry.

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,

  beforeSend(event) {
    // The chat widget is the only place untrusted text is held in the
    // client. If the event has a transaction or URL that looks like the
    // chat route, drop the `extra` field which may carry user prompts.
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
  }
});
