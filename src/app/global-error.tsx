"use client";

/**
 * src/app/global-error.tsx — App Router global error boundary.
 *
 * Catches errors that escape the root layout (i.e. errors that
 * happen *during* the rendering of the layout itself). Because we
 * can't rely on the layout to render — we own the entire <html> here.
 *
 * Also: forwards the error to Sentry. The `digest` property is the
 * server-side hash of the error message (Next.js adds it so we don't
 * leak the original message to the client). Stays the same across
 * requests → easy to dedupe in Sentry.
 *
 * This page is intentionally static (no DB calls, no i18n): we need
 * it to render even when the database is down.
 *
 * Note: the lint rules complain about `<a href="/">` and unescaped
 * apostrophes here. We keep the `<a>` (not `<Link>`) because this
 * page MUST NOT depend on next/link — if the error is in the Link
 * bundle, we still need a working version of the page. The
 * apostrophes are in plain text, not JSX text, so the linter is
 * just being noisy.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#007932",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 600, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Si è verificato un errore
          </h1>
          <p style={{ opacity: 0.9, marginBottom: "1rem" }}>
            L&apos;applicazione ha riscontrato un problema. Il team è stato notificato.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#fff", textDecoration: "underline" }}>
            Torna alla home
          </a>
        </div>
      </body>
    </html>
  );
}
