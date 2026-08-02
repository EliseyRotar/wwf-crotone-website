"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Labels = {
  welcome: string;
  intro: string;
  profile: string;
  logout: string;
  sessions: string;
  sessionsBody: string;
  gdpr: string;
  gdprBody: string;
  myRegistration: string;
  myBookings: string;
  myBookingsBody: string;
};

type Props = {
  firstName: string;
  lastName: string;
  email: string;
  persistent: boolean;
  locale: string;
  labels: Labels;
};

/**
 * Personal-area dashboard. Renders the volunteer's name, a logout
 * button, a link to the existing /mio-iscrizione page, and (Phase 1
 * scope) a placeholder card pointing at the profile page where the
 * per-field edit + GDPR-delete form will live.
 *
 * Logout posts to /api/account/logout and on success replaces the
 * current page with /[locale]/account/login. We intentionally do NOT
 * use Link/router.push before the call so a slow server response
 * doesn't race with the cookie deletion.
 */
export default function AccountHomeClient({
  email,
  persistent,
  locale,
  labels
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "server");
        return;
      }
      router.replace(`/${locale}/account/login`);
      router.refresh();
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container section max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl mb-2">{labels.welcome}</h1>
        <p className="text-ink-2">{labels.intro}</p>
        <p className="text-sm text-ink-grey mt-1">{email}</p>
        {persistent && (
          <p className="text-xs text-ink-grey mt-1">
            <span className="tag tag-green">30d</span>
          </p>
        )}
      </header>

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg mb-2">{labels.myBookings}</h2>
          <p className="text-ink-2 text-sm mb-3">{labels.myBookingsBody}</p>
          <Link className="btn btn-primary" href={`/${locale}/account/bookings`}>
            {labels.myBookings}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg mb-2">{labels.myRegistration}</h2>
          <Link className="btn btn-secondary" href={`/${locale}/mio-iscrizione`}>
            {labels.myRegistration}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg mb-2">{labels.sessions}</h2>
          <p className="text-ink-2 text-sm">{labels.sessionsBody}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg mb-2">{labels.gdpr}</h2>
          <p className="text-ink-2 text-sm mb-3">{labels.gdprBody}</p>
          <Link className="btn btn-secondary" href={`/${locale}/account/profile`}>
            {labels.profile}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary flex items-center gap-2"
          onClick={onLogout}
          disabled={busy}
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {labels.logout}
        </button>
        {error && <span className="text-sm text-tag-red">{error}</span>}
      </div>
    </div>
  );
}
