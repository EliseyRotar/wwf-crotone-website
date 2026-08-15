import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { ErrorPage } from "@/components/ui/ErrorPage";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "404 · WWF Crotone"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

/**
 * Top-level 404. Next.js calls this when no route matches.
 * The [locale]/not-found.tsx handles the locale-specific UI inside the
 * locale layout; this one is the fallback for paths that don't even
 * match /[locale]/* (e.g. /random-garbage).
 *
 * We import globals.css here so the ErrorPage's design-system classes
 * (font-head, text-7xl, text-ink, text-ink-2, btn, btn-primary, etc.)
 * are styled even though this file runs WITHOUT any parent layout.
 * Without the import, the page renders unstyled (404 number appears
 * tiny and black instead of huge and green).
 *
 * We DON'T render <html>/<body> here — Next.js wraps this file in the
 * App Router's root <html>/<body> automatically, since there is no
 * src/app/layout.tsx to provide them. Rendering our own would produce
 * nested <html> tags which is invalid HTML.
 */
export default async function GlobalNotFound() {
  // Read locale from NEXT_LOCALE cookie or Accept-Language header.
  const headerStore = await headers();
  const cookieLocale = (await headerStore.get("cookie")) ?? "";
  const cookieMatch = cookieLocale.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const cookieLocale2 = cookieMatch?.[1];
  const acceptLang = headerStore.get("accept-language") ?? "";
  const acceptMatch = acceptLang.match(/^[a-z]+/);
  const detected = (cookieLocale2 || acceptMatch?.[0] || "it").toLowerCase().startsWith("en")
    ? "en"
    : "it";
  const locale = (detected === "en" ? "en" : "it") as "it" | "en";

  return (
    <>
      <ErrorPage variant="not-found" locale={locale} homeHref={`/${locale}`} />
      <p className="text-center pb-16 -mt-8 text-sm text-ink-grey">
        <Link href={`/${locale}`} className="hover:text-wwf-green transition-colors">
          WWF Crotone
        </Link>
      </p>
    </>
  );
}
