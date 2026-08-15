import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

const locales = ["it", "en"] as const;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(baseUrl),
    description,
    keywords: locale === "it"
      ? [
          "WWF Crotone",
          "campo volontariato Crotone",
          "volontariato ambientale Calabria",
          "tartarughe marine Caretta caretta",
          "Progetto Tartamar",
          "san leonardo di cutro",
          "AMP Capo Rizzuto",
          "CRAS Catanzaro",
          "volontariato estivo",
          "WWF Italia",
          "conservazione biodiversità",
          "pulizia spiagge",
          "recupero animali selvatici",
          "campo estivo natura",
          "educazione ambientale Calabria"
        ]
      : [
          "WWF Crotone",
          "volunteer camp Crotone",
          "environmental volunteering Calabria",
          "sea turtles Caretta caretta",
          "Tartamar project",
          "san leonardo di cutro",
          "Capo Rizzuto MPA",
          "wildlife rescue Italy",
          "summer volunteer camp",
          "WWF Italy",
          "biodiversity conservation",
          "beach cleanup",
          "environmental education Italy"
        ],
    authors: [{ name: "WWF Crotone" }],
    creator: "WWF Crotone",
    publisher: "WWF Crotone",
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
    },
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: {
        "it-IT": `${baseUrl}/it`,
        "en-US": `${baseUrl}/en`,
        "x-default": `${baseUrl}/it`
      }
    },
    openGraph: {
      type: "website",
      locale: locale === "it" ? "it_IT" : "en_US",
      url: `${baseUrl}/${locale}`,
      siteName: "WWF Crotone",
      title,
      description,
      images: [
        {
          url: `${baseUrl}/images/gallery/schiusa_tartarughe.png`,
          width: 1200,
          height: 630,
          alt: locale === "it" ? "Schiusa di tartarughe Caretta caretta — WWF Crotone" : "Caretta caretta hatching — WWF Crotone"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/images/gallery/schiusa_tartarughe.png`],
      creator: "@WWFItalia"
    },
    category: "environment",
    other: {
      "geo.region": "IT-KR",
      "geo.placename": "Crotone",
      "geo.position": "39.0792;17.1279",
      "ICBM": "39.0792, 17.1279"
    }
  };
}

/**
 * Locale-segment layout. Responsibilities are intentionally minimal:
 *
 *  - Validate the [locale] param (so /xx/* → 404).
 *  - Call setRequestLocale() so next-intl can resolve translations
 *    inside server components.
 *  - Export per-locale SEO metadata.
 *
 * The shared chrome (Header / Footer / CookieBanner / MobileStickyCta /
 * ChatWidget / NextIntlClientProvider / fonts / globals.css / dark mode
 * class / NGO JSON-LD) lives in src/app/layout.tsx so it's available
 * on every route — including src/app/not-found.tsx, which has no
 * [locale] parent.
 */
export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  setRequestLocale(locale);
  return <>{children}</>;
}