"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import ThemeToggle from "@/components/layout/ThemeToggle";

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
 * Mobile menu trigger button + slide-out panel.
 * Renders the hamburger (only visible on small screens) and the
 * language switcher + theme toggle that live in the header action area.
 *
 * The desktop nav lives in <ScrollHeader />.
 */
export default function MobileMenu() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Focus trap when the mobile menu is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const container = menuRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const path = (p: string) => `/${locale}/${p}`;
  const isActive = (p: string) => pathname === path(p) || pathname.startsWith(path(p) + "/");

  const otherLocale = locale === "it" ? "en" : "it";
  const otherPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <>
      <ThemeToggle />
      <button
        ref={buttonRef}
        type="button"
        className="lg:hidden inline-flex items-center justify-center p-2 text-ink rounded-lg hover:bg-ink-grey-light/20 min-h-[44px] min-w-[44px]"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      {open && (
        <div
          ref={menuRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t("mobileMenuLabel")}
          className="lg:hidden bg-surface border-t border-ink-grey-light/50 shadow-xl"
        >
          <nav className="container py-4 flex flex-col" aria-label="Mobile">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={path(item.href)}
                className={`py-3 text-base font-semibold tracking-wide border-b border-ink-grey-light/40 ${
                  isActive(item.href) ? "text-wwf-green" : "text-ink"
                }`}
              >
                {t(item.key as keyof typeof NAV_KEYS)}
              </Link>
            ))}
            <div className="flex items-center justify-between pt-4">
              <Link href={otherPath} className="text-sm font-bold uppercase tracking-widest text-ink">
                {otherLocale === "it" ? "IT" : "EN"}
              </Link>
              <Link href={path("dates") + "#form"} className="btn btn-primary">{t("bookNow")}</Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
