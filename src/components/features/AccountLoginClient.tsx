"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; code: string };

/**
 * Account-login form. Renders an email input + "remember this device"
 * opt-in. Submits to /api/account/magic-link which always returns the
 * same generic "ok" response — the success message we show to the
 * user is therefore the same whether or not the address matches an
 * account. This is the intended security property.
 */
export default function AccountLoginClient() {
  const t = useTranslations("Account.login");
  const tErr = useTranslations("Account.errors");
  const loc = useLocale();
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/account/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, locale: loc, remember })
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sentTo?: string;
        error?: string;
      };
      if (res.ok && json.ok) {
        setStatus({ kind: "sent", email: json.sentTo ?? email });
      } else {
        setStatus({ kind: "error", code: json.error ?? "server" });
      }
    } catch {
      setStatus({ kind: "error", code: "network" });
    }
  }

  return (
    <div className="container section max-w-md">
      <h1 className="text-3xl md:text-4xl mb-3">{t("title")}</h1>
      <p className="text-ink-2 mb-6">{t("intro")}</p>

      {status.kind === "sent" ? (
        <div className="card" data-testid="account-sent">
          <div className="card-body">
            <h2 className="text-lg mb-2">{t("sentTitle")}</h2>
            <p className="text-ink-2">{t("sentBody", { email: status.email })}</p>
            <p className="text-sm text-ink-grey mt-3">{t("sentExpiry")}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card">
          <div className="card-body space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                {t("emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="w-full rounded-md border border-ink-line bg-bg px-3 py-2 text-base"
                disabled={status.kind === "sending"}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={status.kind === "sending"}
              />
              <span>{t("rememberLabel")}</span>
            </label>
            <button
              type="submit"
              className="btn btn-primary w-full flex items-center justify-center gap-2"
              disabled={status.kind === "sending"}
            >
              {status.kind === "sending" && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {t("submit")}
            </button>
            {status.kind === "error" && (
              <p className="text-sm text-tag-red" role="alert">
                {tErr(status.code) || tErr("server")}
              </p>
            )}
            <p className="text-xs text-ink-grey">{t("footnote")}</p>
          </div>
        </form>
      )}
    </div>
  );
}
