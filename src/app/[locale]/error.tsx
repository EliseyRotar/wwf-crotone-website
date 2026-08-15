"use client";

import { useEffect, useState } from "react";
import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * Server Component error boundary for any route under [locale].
 * Sentry captures the underlying error automatically; we just render
 * a friendly fallback here with a retry button.
 *
 * Locale is detected from a small client-side fetch of the
 * NEXT_LOCALE cookie via document.cookie (the cookie is httpOnly-safe
 * to read here since the middleware sets it accessible to JS).
 */
export default function LocaleError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<"it" | "en">("it");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
    if (m && m[1].toLowerCase().startsWith("en")) setLocale("en");
    console.error("[locale-error]", error);
  }, [error]);

  return (
    <ErrorPage
      variant="server-error"
      locale={locale}
      homeHref={`/${locale}`}
      error={error}
      onRetry={reset}
    />
  );
}
