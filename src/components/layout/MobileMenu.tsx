"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, UserRound } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

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
 * Mobile nav: a hamburger button (lg:hidden) that opens a slide-in
 * drawer from the right. The drawer is rendered via createPortal so
 * it escapes the header's flexbox + height clipping — the previous
 * implementation tried to inline the menu inside the header, which
 * got positioned off-screen because the header is a sticky element
 * with fixed height.
 *
 * Behaviour:
 *   - Click hamburger → drawer slides in from the right
 *   - Press Escape or click the backdrop → drawer closes
 *   - Focus is trapped inside the drawer while open
 *   - Body scroll is locked while open
 */
export default function MobileMenu() {
  const t = useTranslations("Nav");
  const loc = useLocale();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const path = (p: string) => `/${loc}/${p}`;
  const isActive = (p: string) => pathname === path(p) || pathname.startsWith(path(p) + "/");
  const otherLocale = loc === "it" ? "en" : "it";
  const otherPath = pathname.replace(`/${loc}`, `/${otherLocale}`);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while open + restore focus
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      buttonRef.current?.focus();
    };
  }, [open]);

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
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
        <>
          {/* Backdrop — covers the rest of the viewport */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Slide-in drawer from the right */}
          <div
            ref={drawerRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t("mobileMenuLabel")}
            tabIndex={-1}
            className="lg:hidden fixed inset-y-0 right-0 z-50 w-[min(20rem,85vw)] bg-surface shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-grey-light/40">
              <span className="font-head text-sm uppercase tracking-wider text-ink">
                {t("mobileMenuLabel")}
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("closeMenu")}
                className="p-2 -mr-2 text-ink hover:text-wwf-green transition-colors"
              >
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2" aria-label={t("mobileMenuLabel")}>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={path(item.href)}
                  className={`block px-5 py-3 text-base font-semibold tracking-wide border-b border-ink-grey-light/30 ${
                    isActive(item.href) ? "text-wwf-green bg-wwf-green-pale/30" : "text-ink hover:bg-ink-grey-light/10"
                  }`}
                >
                  {t(item.key as keyof typeof NAV_KEYS)}
                </Link>
              ))}
              <Link
                href={path("account")}
                className="flex items-center gap-2 px-5 py-3 text-base font-semibold tracking-wide border-b border-ink-grey-light/30 text-ink hover:bg-ink-grey-light/10"
              >
                <UserRound size={18} aria-hidden="true" />
                {t("personalArea")}
              </Link>
            </nav>
            <div className="px-5 py-4 border-t border-ink-grey-light/40 flex items-center justify-between gap-3">
              <Link
                href={otherPath}
                className="text-sm font-bold uppercase tracking-widest text-ink hover:text-wwf-green"
              >
                {otherLocale === "it" ? "IT" : "EN"}
              </Link>
              <Link
                href={path("dates") + "#form"}
                className="btn btn-primary text-sm px-4 py-2"
              >
                {t("bookNow")}
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}