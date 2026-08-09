import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const err = new Error("wwf-sentry-wiring-check-" + Math.random().toString(36).slice(2, 10));
  Sentry.captureException(err);
  await Sentry.flush(2000);
  return Response.json({ sent: err.message, dsn_enabled: !!process.env.SENTRY_DSN });
}
