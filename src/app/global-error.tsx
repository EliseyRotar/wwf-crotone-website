"use client";

import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * Top-level catastrophic error boundary. Replaces the entire <html>
 * element so the brand header/footer don't break. The ErrorPage
 * renders its own minimal html/body when minimal=true.
 *
 * Triggered by: errors in the root layout, or anything that escapes
 * the [locale] error.tsx boundary.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      variant="global-error"
      locale="it"
      homeHref="/it"
      error={error}
      onRetry={reset}
      minimal
    />
  );
}
