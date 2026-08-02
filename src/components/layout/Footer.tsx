import Link from "next/link";
import { Facebook, Instagram, Mail, Phone } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { SITE } from "@/config/site";
import NewsletterForm from "@/components/features/NewsletterForm";

export default function Footer() {
  const t = useTranslations("Footer");
  const tNav = useTranslations("Nav");
  const tA = useTranslations("A11y");
  const locale = useLocale();
  const year = new Date().getFullYear();

  const path = (p: string) => `/${locale}/${p}`;

  return (
    <footer className="bg-ink text-white" style={{ background: "var(--c-footer-bg)" }}>
      <div className="container py-16 lg:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/wwf-panda.jpg" alt={tA("logoAlt")} className="h-12 w-auto mb-5 rounded-md bg-white p-1.5" />
            <p className="font-head text-xl tracking-tight mb-2">{t("orgName")}</p>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">{locale === "it" ? SITE.orgLineIt : SITE.orgLineEn}</p>
            <p className="text-sm text-white/50 mb-6">{t("address")}</p>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-3 text-white/70 hover:text-wwf-orange transition-colors">
                  <Mail size={16} className="text-wwf-orange" /> {SITE.email}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phoneField.replace(/\s/g, "")}`} className="inline-flex items-center gap-3 text-white/70 hover:text-wwf-orange transition-colors">
                  <Phone size={16} className="text-wwf-orange" /> {t("fieldLabel")} — {SITE.phoneField}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phonePaolo.replace(/\s/g, "")}`} className="inline-flex items-center gap-3 text-white/70 hover:text-wwf-orange transition-colors">
                  <Phone size={16} className="text-wwf-orange" /> {t("paoloLabel")} — {SITE.phonePaolo}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-head text-sm uppercase tracking-widest mb-5 text-white/40">{tNav("home")}</p>
            <ul className="space-y-3 text-sm">
              {(["about", "activities", "dates", "gallery", "support", "faq", "contact"] as const).map((k) => (
                <li key={k}>
                  <Link href={path(k)} className="text-white/70 hover:text-wwf-orange transition-colors">
                    {tNav(k)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-head text-sm uppercase tracking-widest mb-5 text-white/40">{t("legal")}</p>
            <ul className="space-y-3 text-sm">
              <li><Link href={path("privacy")} className="text-white/70 hover:text-wwf-orange transition-colors">{t("privacyPolicy")}</Link></li>
              <li><Link href={path("privacy")} className="text-white/70 hover:text-wwf-orange transition-colors">{t("cookiePolicy")}</Link></li>
            </ul>
            <p className="font-head text-sm uppercase tracking-widest mb-4 mt-8 text-white/40">{t("followUs")}</p>
            <div className="flex gap-2">
              <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-lg border border-white/20 flex items-center justify-center hover:border-wwf-orange hover:text-wwf-orange hover:bg-wwf-orange/10 transition-all">
                <Facebook size={18} />
              </a>
              <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-lg border border-white/20 flex items-center justify-center hover:border-wwf-orange hover:text-wwf-orange hover:bg-wwf-orange/10 transition-all">
                <Instagram size={18} />
              </a>
            </div>
          </div>

          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>{t("rights", { year })}</p>
          <p>{t("credit")}</p>
        </div>
      </div>
    </footer>
  );
}
