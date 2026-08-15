"use client";

import { useEffect } from "react";
import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * Admin panel error boundary. Same component as the public one but
 * locale is locked to IT (admin is internal-only).
 */
export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <ErrorPage
      variant="server-error"
      locale="it"
      homeHref="/admin"
      error={error}
      onRetry={reset}
    />
  );
}
