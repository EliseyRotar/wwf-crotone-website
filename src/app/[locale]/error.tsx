"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container section text-center">
      <h1 className="text-3xl md:text-4xl mb-4">Something went wrong</h1>
      <p className="text-ink-grey mb-6">An unexpected error occurred. Please try again.</p>
      <button onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
