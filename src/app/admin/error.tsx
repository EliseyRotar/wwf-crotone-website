"use client";

import { useEffect } from "react";

export default function AdminError({
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
    <div className="text-center py-20">
      <h1 className="text-3xl mb-4">Admin Error</h1>
      <p className="text-ink-grey mb-6">Something went wrong in the admin panel.</p>
      <button onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
