"use client";

import Link from "next/link";
import { useState } from "react";
import { Facebook, Instagram, Mail, Phone } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { SITE } from "@/lib/site";

export default function Footer() {
  const t = useTranslations("Footer");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const year = new Date().getFullYear();

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err" | "loading">("idle");

  const path = (p: string) => `/${locale}/${p}`;

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
    <footer className="bg-ink text-white" style={{ background: "var(--c-footer-bg)" }}>
      <div className="container py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Org info */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/wwf-panda.jpg" alt="WWF" className="h-14 w-auto mb-4 rounded-sm bg-white p-1.5" />
            <p className="font-head text-lg uppercase tracking-head mb-1">{t("orgName")}</p>
            <p className="text-sm text-white/70 mb-3">{locale === "it" ? SITE.orgLineIt : SITE.orgLineEn}</p>
            <p className="text-sm text-white/70 mb-4">{t("address")}</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-2 hover:text-wwf-orange">
                  <Mail size={16} /> {SITE.email}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phoneField.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 hover:text-wwf-orange">
                  <Phone size={16} /> {t("fieldLabel")} — {SITE.phoneField}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phonePaolo.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 hover:text-wwf-orange">
                  <Phone size={16} /> {t("paoloLabel")} — {SITE.phonePaolo}
                </a>
              </li>
            </ul>
          </div>

          {/* Nav */}
          <div>
            <p className="font-head text-sm uppercase tracking-cta mb-4 text-white/60">{tNav("home")}</p>
            <ul className="space-y-2 text-sm">
              {["about", "activities", "dates", "gallery", "faq", "contact"].map((k) => (
                <li key={k}>
                  <Link href={path(k)} className="text-white/80 hover:text-wwf-orange">
                    {tNav.has(k as never) ? tNav(k as never) : k}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="font-head text-sm uppercase tracking-cta mb-4 text-white/60">{t("legal")}</p>
            <ul className="space-y-2 text-sm">
              <li><Link href={path("privacy")} className="text-white/80 hover:text-wwf-orange">{t("privacyPolicy")}</Link></li>
              <li><Link href={path("privacy")} className="text-white/80 hover:text-wwf-orange">{t("cookiePolicy")}</Link></li>
            </ul>
            <p className="font-head text-sm uppercase tracking-cta mb-4 mt-6 text-white/60">{t("followUs")}</p>
            <div className="flex gap-3">
              <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="p-2 border border-white/30 hover:border-wwf-orange hover:text-wwf-orange">
                <Facebook size={18} />
              </a>
              <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="p-2 border border-white/30 hover:border-wwf-orange hover:text-wwf-orange">
                <Instagram size={18} />
              </a>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <p className="font-head text-sm uppercase tracking-cta mb-4 text-white/60">{t("newsletterTitle")}</p>
            <p className="text-sm text-white/70 mb-4">{t("newsletterBody")}</p>
            {status === "ok" ? (
              <p className="text-sm text-wwf-green-light font-semibold">{t("newsletterOk")}</p>
            ) : (
              <form onSubmit={onSubscribe} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("newsletterPlaceholder")}
                  className="w-full bg-white/10 border border-white/30 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-wwf-orange"
                />
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
                  {t("newsletterBtn")}
                </button>
                {status === "err" && <p className="text-xs text-wwf-red">{t("newsletterErr")}</p>}
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-white/60">
          <p>{t("rights", { year })}</p>
          <p>{t("credit")}</p>
        </div>
      </div>
    </footer>
  );
}