# Sentry — Setup & Verification

This project uses [Sentry](https://sentry.io) for error monitoring and
tracing. The setup is **optional** — the SDK is a no-op when `SENTRY_DSN`
is empty, so the app runs fine without it.

The Sentry project is `javascript-nextjs` under the org
`wwf-provincia-di-crotone-ets` (created 2025-08).

## Architecture

The setup is the [manual Sentry SDK for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
because the project already had partial Sentry config (instrumentation
hooks, client + server init) and adding the wizard would have produced
duplicate files.

Five files together wire the SDK:

| File | Role |
| --- | --- |
| `next.config.js` | Wraps the config with `withSentryConfig` (source-map upload, build-time options). |
| `instrumentation.ts` | Next.js hook — loads server or edge config based on `NEXT_RUNTIME`. Exports `onRequestError` for server-side error capture. |
| `instrumentation-client.ts` | Browser-side SDK init. Captures client errors, page navigations, and chat-route PII is stripped. |
| `sentry.server.config.ts` | Node.js runtime init. 10% trace sample rate in prod, 100% in dev. PII off by default. |
| `sentry.edge.config.ts` | Edge runtime init (used by `src/middleware.ts`). |
| `src/app/global-error.tsx` | App Router error boundary — captures anything that escapes the root layout. |

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SENTRY_DSN` | yes (for capturing) | Server-side DSN. The SDK is a no-op when empty. |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Browser-side DSN. Falls back to `SENTRY_DSN`. `NEXT_PUBLIC_*` is fine — Sentry DSNs are designed to be public. |
| `SENTRY_ORG` | optional | Default: `wwf-provincia-di-crotone-ets`. |
| `SENTRY_PROJECT` | optional | Default: `javascript-nextjs`. |
| `SENTRY_AUTH_TOKEN` | only for CI/deploy | Source-map upload. Setting it enables `uploadSourceMaps` in the build. Never commit. |

## What we capture

- **Errors**: every uncaught exception in Node.js, Edge, and browser.
- **Traces**: 10% of transactions in production (100% in dev). Tweak
  `tracesSampleRate` in `sentry.server.config.ts` if we hit the
  free-tier limit.
- **Router transitions**: client-side route changes become spans.
- **Failed requests**: caught by `onRequestError` at the framework
  layer.

## What we DON'T capture

- **Session Replay**: not enabled. The site doesn't have heavy
  client-side state and the GDPR cost of replays outweighs the
  debugging benefit for our scale.
- **User Feedback widget**: we use Brevo mail for support requests.
- **Logs / Metrics / Profiling**: deferred — we ship to stdout and
  tail Docker logs.
- **PII**: `sendDefaultPii: false`. The `beforeSend` hook additionally
  strips `user.ip_address`, `user.email`, `user.username`, and `extra`
  on any event originating from the chat route (the only place
  untrusted text enters the app).

## Verification

1. Set `SENTRY_DSN` in `.env.production` (or locally).
2. Deploy OR run `npm run dev`.
3. Visit `https://<your-host>/sentry-example-page` — the page renders
   a "Break the world" button when Sentry is configured.
4. Click the button.
5. Within ~10 seconds, the error should appear in the Sentry dashboard
   at `https://wwf-provincia-di-crotone-ets.sentry.io/issues/`.

## Source maps

Set `SENTRY_AUTH_TOKEN` in the CI environment (e.g. in the GitHub
Actions deploy workflow). The build step will then upload source maps
for both server and client bundles, so stack traces are readable.

The token needs scope `project:releases`. Create one at
<https://sentry.io/settings/auth-tokens/>.

## Production checklist

- [ ] `SENTRY_DSN` is set in `.env.production`
- [ ] `SENTRY_AUTH_TOKEN` is set in the deploy CI (GitHub Actions secret)
- [ ] After deploy, visit `/sentry-example-page` and click the button
- [ ] Confirm the test error appears in the Sentry dashboard
- [ ] Confirm the deploy release is showing up under `Releases`
