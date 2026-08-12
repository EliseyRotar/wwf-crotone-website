"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/**
 * Tiny client island used inside the dashboard's account row.
 * Renders the "Esci" (sign out) text link styled in red.
 *
 * On click: posts to /api/account/logout, then router-replaces to
 * /account/login (no flicker because we update the navigation only
 * after the server confirms the cookie was deleted). Uses
 * useTransition so the row doesn't tear while the request is in
 * flight.
 */
export default function LogoutLink({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const t = useTranslations("Account.errors");

  function onClick() {
    if (pending) return;
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/account/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: "{}"
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setErr(j.error ?? "server");
          return;
        }
        router.replace("/it/account/login");
        router.refresh();
      } catch {
        setErr("network");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-sm text-[var(--c-ink-red,#ed2b00)] hover:underline inline-flex items-center gap-1 disabled:opacity-50"
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {label}
      </button>
      {err && <span className="text-xs text-[var(--c-ink-red,#ed2b00)]">{t(err)}</span>}
    </span>
  );
}