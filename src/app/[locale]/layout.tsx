import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import MobileStickyCta from "@/components/MobileStickyCta";
import { SITE } from "@/lib/site";
import "@/app/globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-head",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap"
});

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
    title: {
      default: title,
      template: `%s · WWF Crotone`
    },
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
          url: "/images/gallery/schiusa tartarughe.png",
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
      images: ["/images/gallery/schiusa tartarughe.png"],
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

  const messages = await getMessages();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: "WWF Crotone",
    alternateName: "WWF Provincia di Crotone",
    url: `${baseUrl}/${locale}`,
    logo: `${baseUrl}/logos/wwf.png`,
    description: locale === "it"
      ? "Campi di volontariato WWF Crotone: tutela delle tartarughe marine Caretta caretta, pulizia delle spiagge, recupero animali selvatici. Estate 2026, San Leonardo di Cutro (KR)."
      : "WWF Crotone volunteer camps: protect Caretta caretta sea turtles, beach cleanup, wildlife rescue. Summer 2026, San Leonardo di Cutro (KR), Calabria.",
    email: SITE.email,
    telephone: SITE.phoneField,
    address: {
      "@type": "PostalAddress",
      addressLocality: "San Leonardo di Cutro",
      addressRegion: "KR",
      addressCountry: "IT"
    },
    sameAs: [SITE.facebook, SITE.instagram],
    parentOrganization: {
      "@type": "NGO",
      name: "WWF Italia ETS",
      url: "https://www.wwf.it"
    },
    knowsAbout: [
      "Caretta caretta",
      "sea turtle conservation",
      "marine protected areas",
      "Capo Rizzuto",
      "volunteer camps",
      "environmental education",
      "wildlife rescue",
      "biodiversity conservation",
      "Calabria",
      "Tartamar project"
    ]
  };

  const eventLd = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    name: "Campi di Volontariato WWF Crotone 2026",
    description: locale === "it"
      ? "12 turni settimanali di volontariato ambientale dal 21 giugno al 13 settembre 2026: monitoraggio tartarughe marine, pulizia spiagge, recupero animali selvatici."
      : "12 weekly volunteer turns from June 21 to September 13, 2026: sea turtle monitoring, beach cleanup, wildlife rescue.",
    startDate: "2026-06-21",
    endDate: "2026-09-13",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "C.E.L.A. — Centro di Educazione alla Legalità e all'Ambiente",
      address: {
        "@type": "PostalAddress",
        addressLocality: "San Leonardo di Cutro",
        addressRegion: "KR",
        addressCountry: "IT"
      }
    },
    organizer: {
      "@type": "NGO",
      name: "WWF Crotone",
      url: `${baseUrl}/${locale}`
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: "400",
      highPrice: "450",
      availability: "https://schema.org/InStock"
    }
  };

  return (
    <html lang={locale} className={`${oswald.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.style.colorScheme="light";}}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CookieBanner />
          <MobileStickyCta />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}