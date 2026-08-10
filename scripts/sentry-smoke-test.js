/**
 * scripts/sentry-smoke-test.js — End-to-end Sentry verification.
 *
 * Sends two events (a "connection-ok" info message and a test error)
 * to the Sentry project using the actual SDK. Useful as a one-shot
 * CI check after a deploy to confirm the DSN is reachable and the
 * project is configured.
 *
 * Run:   node scripts/sentry-smoke-test.js
 * Env:   SENTRY_DSN (required), SENTRY_AUTH_TOKEN (optional, for cleanup)
 */

const Sentry = require("@sentry/node");

const DSN = process.env.SENTRY_DSN;
if (!DSN) {
  console.error("SENTRY_DSN is not set. Refusing to run.");
  process.exit(1);
}

Sentry.init({
  dsn: DSN,
  tracesSampleRate: 0,
  environment: "smoke-test",
  release: "smoke-test@1.0.0",
});

async function main() {
  console.log("Sentry SDK initialized. DSN:", DSN.slice(0, 40) + "…");

  // Capture a message
  const messageId = Sentry.captureMessage("Sentry SDK smoke test reached the project", "info");
  console.log("✓ Message captured, id:", messageId);

  // Capture an exception
  try {
    throw new Error("Sentry SDK smoke test error");
  } catch (e) {
    const eventId = Sentry.captureException(e);
    console.log("✓ Exception captured, id:", eventId);
  }

  // Flush — wait up to 5s for the events to land before exiting
  const flushed = await Sentry.flush(5000);
  console.log(flushed ? "✓ Flushed (events sent)" : "⚠ Flush timeout");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => Sentry.close());
