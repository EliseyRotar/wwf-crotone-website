import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Faq" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/faq` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/faq`
    }
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Faq");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const items = (await t.raw("items")) as { q: string; a: string }[];

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-5">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-12 leading-relaxed">{t("intro")}</p>

      <div className="max-w-3xl">
        <FaqAccordion items={items} />
      </div>
    </div>
  );
}