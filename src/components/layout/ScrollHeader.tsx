"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useScrollFlag } from "@/hooks/useScrollFlag";
import SiteSearch from "@/components/features/SiteSearch";

const NAV_KEYS = {
  about: "about",
  activities: "activities",
  dates: "dates",
  gallery: "gallery",
  support: "support",
  faq: "faq",
  contact: "contact"
} as const;

const NAV_ITEMS = [
  { href: "about", key: "about" },
  { href: "activities", key: "activities" },
  { href: "dates", key: "dates" },
  { href: "gallery", key: "gallery" },
  { href: "support", key: "support" },
  { href: "faq", key: "faq" },
  { href: "contact", key: "contact" }
] as const;

/**
 * Client-side scrolled-state wrapper for the header element.
 * Also renders the desktop nav, language switcher, and "Book now" CTA,
 * because all of those need usePathname() / useLocale().
 *
 * The mobile hamburger + slide-out panel is delegated to <MobileMenu />.
 */
export default function ScrollHeader({
  rightSlot
}: {
  rightSlot: React.ReactNode;
}) {
  const t = useTranslations("Nav");
  const tA = useTranslations("A11y");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const scrolled = useScrollFlag(20);

  const path = (p: string) => `/${locale}/${p}`;
  const isActive = (p: string) => pathname === path(p) || pathname.startsWith(path(p) + "/");

  const otherLocale = locale === "it" ? "en" : "it";
  const otherPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <div className={`h-full transition-all duration-300 ${
      scrolled ? "header-glass shadow-sm" : "bg-transparent border-transparent"
    }`}>
      <div className="container h-full flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="flex items-center gap-3 shrink-0" aria-label={t("home")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/wwf.png" alt={tA("logoAlt")} className="h-10 w-auto dark:brightness-0 dark:invert" width="40" height="40" />
        </Link>

        <nav className="hidden lg:flex items-center gap-0" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={path(item.href)}
              className={`relative px-3 py-2 text-sm font-semibold tracking-wide transition-colors ${
                isActive(item.href) ? "text-wwf-green" : "text-ink hover:text-wwf-green"
              }`}
            >
              {t(item.key as keyof typeof NAV_KEYS)}
              {isActive(item.href) && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-wwf-green rounded-full" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <SiteSearch />
          <Link
            href={otherPath}
            className="hidden sm:inline-flex text-xs font-bold uppercase tracking-widest px-3 py-2 text-ink hover:text-wwf-green transition-colors"
            aria-label={t("switch")}
          >
            {otherLocale.toUpperCase()}
          </Link>
          <Link href={path("dates") + "#form"} className="hidden sm:inline-flex btn btn-primary text-sm px-5 py-2.5">
            {t("bookNow")}
          </Link>
          {rightSlot}
        </div>
      </div>
    </div>
  );
}
