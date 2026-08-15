import type { Metadata, Viewport } from "next";
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CookieBanner from "@/components/ui/CookieBanner";
import MobileStickyCta from "@/components/layout/MobileStickyCta";
import ChatWidget from "@/components/features/ChatWidget";
import PlausibleAnalytics from "@/components/layout/PlausibleAnalytics";
import { SITE } from "@/config/site";
import "@/app/globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-head",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "WWF Crotone",
    template: `%s · WWF Crotone`
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5
};

/**
 * Root layout. Renders the <html><body> shell that EVERY route segment
 * in the app inherits — including the top-level src/app/not-found.tsx
 * (which has no [locale] parent), the admin shell, and api/* error
 * responses. Without this file, Next.js 15 has no <html> wrapper for
 * routes that bypass the [locale] segment, and the top-level 404
 * rendered as raw unstyled HTML.
 *
 * Responsibilities:
 *  - Load the three Google fonts (Oswald/Inter/JetBrains Mono) and
 *    expose them as CSS variables that Tailwind and globals.css consume.
 *  - Import globals.css once for the entire app — every route gets
 *    the design-system CSS (Tailwind output + WWF tokens + .container /
 *    .section / .card / .btn / .tag classes).
 *  - Detect the locale from the URL (via next-intl's getLocale()) so
 *    <html lang={locale}> is correct for both /it/*, /en/* and routes
 *    that have no locale prefix (e.g. /admin, /random-garbage).
 *  - Apply the dark-mode class on <html> based on the 'theme' cookie
 *    so the first paint matches the user's preference BEFORE the
 *    inline hydration script runs.
 *  - Wrap children in NextIntlClientProvider so client components
 *    (Header, ChatWidget, CookieBanner, etc.) can useTranslations().
 *    next-intl v3.18+ requires the provider even when only client
 *    children use translations.
 *  - Render the chrome (Header / Footer / CookieBanner / MobileStickyCta /
 *    ChatWidget / PlausibleAnalytics) — they're locale-aware but
 *    their data sources (SITE constants, getMessages()) are reachable
 *    from the root.
 *
 * What we DO NOT do here:
 *  - Per-route metadata — handled by each page's generateMetadata.
 *  - Per-route JSON-LD payloads — each page emits its own breadcrumb
 *    / article / NGO JSON-LD inline. The NGO organization-level
 *    payload lives below.
 */
export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // next-intl reads the locale from the URL prefix (/it, /en) and
  // falls back to the configured default ("it"). For non-locale routes
  // (admin, api, random-garbage) it returns the default.
  const locale = await getLocale();
  const messages = await getMessages();

  const store = await cookies();
  const themeCookie = store.get("theme")?.value;
  const isDark = themeCookie === "dark";

  const headerStore = await headers();
  const nonce = headerStore.get("x-nonce") ?? undefined;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Organization-level JSON-LD. Per-route JSON-LD (BreadcrumbList,
  // Article, FAQ, etc.) is emitted by each page.
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "NGO",
    "@id": `${baseUrl}#org`,
    name: SITE.name,
    legalName: SITE.legalName,
    url: `${baseUrl}`,
    logo: `${baseUrl}/icon-192.png`,
    email: SITE.email,
    telephone: SITE.phoneField,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.sedeLegale,
      addressLocality: "Cutro",
      addressRegion: "KR",
      postalCode: "88842",
      addressCountry: "IT"
    },
    sameAs: [SITE.facebook, SITE.instagram, SITE.googleBusiness].filter(Boolean)
  };

  return (
    <html
      lang={locale}
      className={`${oswald.variable} ${inter.variable} ${jetbrains.variable} ${isDark ? "dark" : ""}`}
      style={{ colorScheme: isDark ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={isDark ? "#141413" : "#007932"} />
        {/* Preconnect to Sentry ingest + DNS-prefetch CARTO. Cuts the
            first-event / first-tile latency for unhandled errors and
            for the Leaflet basemap on /about and /activities. */}
        <link
          rel="preconnect"
          href="https://o4511881999679488.ingest.de.sentry.io"
          crossOrigin=""
        />
        <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
        <PlausibleAnalytics />
        {/* Inline theme-hydration script — re-applies dark vs light
            after React mounts (the cookie alone isn't enough; we also
            honour localStorage and prefers-color-scheme). */}
        <script
          nonce={nonce ?? undefined}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(!t){var c=document.cookie.match(/theme=(dark|light)/);t=c?c[1]:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <script
          nonce={nonce ?? undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CookieBanner />
          <MobileStickyCta />
          <ChatWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}