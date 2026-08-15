import Link from "next/link";
import { headers } from "next/headers";
import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * Top-level 404. Next.js calls this when no route matches.
 * The [locale]/not-found.tsx handles the locale-specific UI inside the
 * locale layout; this one is the fallback for paths that don't even
 * match /[locale]/* (e.g. /random-garbage).
 *
 * We rely on src/app/layout.tsx to provide the <html>/<body> shell and
 * to import globals.css — this means the design-system classes inside
 * ErrorPage (font-head, text-7xl, text-ink, text-ink-2, btn,
 * btn-primary, btn-outline) all render correctly here, and the page
 * also gets the shared chrome (Header / Footer / CookieBanner / etc.).
 *
 * We do NOT re-export metadata or viewport from this file — the root
 * layout owns those. If we did, Next.js would throw 'You cannot
 * export metadata/viewport from a page that is also rendered inside a
 * layout that exports them' (the root layout exports both).
 */
export default async function GlobalNotFound() {
  // Read locale from NEXT_LOCALE cookie or Accept-Language header.
  // (We can't read params here because not-found.tsx runs at the App
  // Router root where there are no params.)
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