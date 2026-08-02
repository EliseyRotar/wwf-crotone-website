import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import FaqAccordion, { type FaqCategory } from "@/components/ui/FaqAccordion";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Faq" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/faq` },
    openGraph: { title: `${t("title")} · WWF Crotone`, description: t("intro"), url: `${baseUrl}/${locale}/faq` }
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Faq");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const itemsByCategory = (await t.raw("groupedItems")) as Record<string, { q: string; a: string }[]>;
  const flatItems = Object.values(itemsByCategory).flat();

  const categories: FaqCategory[] = [
    { id: "generale", label: t("categories.generale"), items: itemsByCategory.generale ?? [] },
    { id: "iscrizione", label: t("categories.iscrizione"), items: itemsByCategory.iscrizione ?? [] },
    { id: "logistica", label: t("categories.logistica"), items: itemsByCategory.logistica ?? [] },
    { id: "salute", label: t("categories.salute"), items: itemsByCategory.salute ?? [] },
    { id: "pagamento", label: t("categories.pagamento"), items: itemsByCategory.pagamento ?? [] },
    { id: "attivita", label: t("categories.attivita"), items: itemsByCategory.attivita ?? [] },
    { id: "dopo", label: t("categories.dopo"), items: itemsByCategory.dopo ?? [] }
  ].filter((c) => c.items.length > 0);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: flatItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a
      }
    }))
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: tNav("home"),
        item: `${baseUrl}/${loc}`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("title"),
        item: `${baseUrl}/${loc}/faq`
      }
    ]
  };

  return (
    <div className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="mb-6">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-12 leading-relaxed">{t("intro")}</p>

      <FaqAccordion
        categories={categories}
        contactHref={`/${loc}/contact`}
      />
    </div>
  );
}
