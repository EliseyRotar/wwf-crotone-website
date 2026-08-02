"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Labels = {
  title: string;
  intro: string;
  sectionGdpr: string;
  gdprBody: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  confirmLabel: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  back: string;
};

type Props = {
  email: string;
  locale: string;
  labels: Labels;
};

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; code: string };

/**
 * Phase 1 GDPR delete form. We DO NOT delete the data here — the
 * admin handles the actual erasure after verifying identity (per the
 * spec). The form sends the volunteer's reason + email-confirmation
 * to /api/account/gdpr-delete, which notifies the admin and writes an
 * audit log row.
 *
 * The confirm-email field is a friction step on purpose: it
 * dramatically reduces accidental submissions and stops an attacker
 * with a stolen cookie from wiping the account without knowing the
 * email on file.
 */
export default function AccountProfileClient({ email, locale, labels }: Props) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/account/gdpr-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reason,
          confirmEmail: confirm,
          locale
        })
      });
      if (res.ok) {
        setStatus({ kind: "success" });
        setReason("");
        setConfirm("");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus({ kind: "error", code: j.error ?? "server" });
    } catch {
      setStatus({ kind: "error", code: "network" });
    }
  }

  if (status.kind === "success") {
    return (
      <div className="container section max-w-md">
        <h1 className="text-3xl md:text-4xl mb-3">{labels.successTitle}</h1>
        <p className="text-ink-2 mb-6">{labels.successBody}</p>
        <Link className="btn btn-secondary" href={`/${locale}/account`}>
          {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="container section max-w-md">
      <h1 className="text-3xl md:text-4xl mb-3">{labels.title}</h1>
      <p className="text-ink-2 mb-6">{labels.intro}</p>

      <section className="card">
        <div className="card-body">
          <h2 className="text-lg mb-2">{labels.sectionGdpr}</h2>
          <p className="text-ink-2 text-sm mb-4">{labels.gdprBody}</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-sm font-medium mb-1">
                {labels.reasonLabel}
              </label>
              <textarea
                id="reason"
                required
                minLength={1}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={labels.reasonPlaceholder}
                rows={4}
                className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base"
                disabled={status.kind === "sending"}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-1">
                {labels.confirmLabel}
              </label>
              <input
                id="confirm"
                type="email"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base"
                disabled={status.kind === "sending"}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full flex items-center justify-center gap-2"
              disabled={status.kind === "sending"}
            >
              {status.kind === "sending" && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {status.kind === "sending" ? labels.submitting : labels.submit}
            </button>
            {status.kind === "error" && (
              <p className="text-sm text-tag-red" role="alert">
                {status.code}
              </p>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
