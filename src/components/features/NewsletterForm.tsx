"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

export default function NewsletterForm() {
  const t = useTranslations("Footer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err" | "loading">("idle");

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !consent) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, consent })
      });
      if (res.ok) {
        setStatus("ok");
        setEmail("");
      } else {
        setStatus("err");
      }
    } catch {
      setStatus("err");
    }
  };

  return (
    <div>
      <p className="font-head text-sm uppercase tracking-cta mb-4 text-white/60">{t("newsletterTitle")}</p>
      <p className="text-sm text-white/70 mb-4">{t("newsletterBody")}</p>
      {status === "ok" ? (
        <p className="text-sm text-wwf-green-light font-semibold">{t("newsletterOk")}</p>
      ) : (
        <form onSubmit={onSubscribe} className="space-y-3">
          <div className="field">
            <label htmlFor="nl-email" className="sr-only">{t("newsletterPlaceholder")}</label>
            <input
              id="nl-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletterPlaceholder")}
              className="w-full bg-white/10 border border-white/30 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-wwf-orange"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="mt-0.5"
            />
            <span>{t("newsletterConsent")}</span>
          </label>
          <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
            {status === "loading" ? "..." : t("newsletterBtn")}
          </button>
          {status === "err" && <p className="text-xs text-wwf-red">{t("newsletterErr")}</p>}
        </form>
      )}
    </div>
  );
}
