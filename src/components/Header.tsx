"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "about", key: "about" },
    { href: "activities", key: "activities" },
    { href: "dates", key: "dates" },
    { href: "gallery", key: "gallery" },
    { href: "faq", key: "faq" },
    { href: "contact", key: "contact" }
  ] as const;

  const path = (p: string) => `/${locale}/${p}`;
  const isActive = (p: string) => pathname === path(p) || pathname.startsWith(path(p) + "/");

  const otherLocale = locale === "it" ? "en" : "it";
  const otherPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <>
      <a href="#main" className="skip-link">{t("skipToContent")}</a>
      <header
        className={`sticky top-0 z-40 bg-surface border-b transition-shadow ${
          scrolled ? "shadow-md border-ink-grey-light" : "border-transparent"
        }`}
        style={{ height: "var(--header-h)" }}
      >
        <div className="container h-full flex items-center justify-between gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-3 shrink-0" aria-label={t("home")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/wwf.png" alt="WWF" className="h-10 w-auto dark:brightness-0 dark:invert" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={path(item.href)}
                className={`px-3 py-2 text-sm font-bold uppercase tracking-cta transition-colors ${
                  isActive(item.href) ? "text-wwf-green" : "text-ink hover:text-wwf-green"
                }`}
              >
                {t(item.key as keyof typeof NAV_KEYS)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href={otherPath}
              className="hidden sm:inline-flex text-xs font-bold uppercase tracking-cta px-3 py-2 text-ink hover:text-wwf-green"
              aria-label={locale === "it" ? "Switch to English" : "Passa all'italiano"}
            >
              {otherLocale.toUpperCase()}
            </Link>
            <Link href={path("dates") + "#form"} className="hidden sm:inline-flex btn btn-primary">
              {t("bookNow")}
            </Link>
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center p-2 text-ink"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden bg-surface border-t border-ink-grey-light shadow-lg">
            <nav className="container py-4 flex flex-col" aria-label="Mobile">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={path(item.href)}
                  className={`py-3 text-base font-bold uppercase tracking-cta border-b border-ink-grey-light/60 ${
                    isActive(item.href) ? "text-wwf-green" : "text-ink"
                  }`}
                >
                  {t(item.key as keyof typeof NAV_KEYS)}
                </Link>
              ))}
              <div className="flex items-center justify-between pt-4">
                <Link href={otherPath} className="text-sm font-bold uppercase tracking-cta text-ink">
                  {otherLocale === "it" ? "IT" : "EN"}
                </Link>
                <Link href={path("dates") + "#form"} className="btn btn-primary">{t("bookNow")}</Link>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

const NAV_KEYS = {
  about: "about",
  activities: "activities",
  dates: "dates",
  gallery: "gallery",
  faq: "faq",
  contact: "contact"
} as const;