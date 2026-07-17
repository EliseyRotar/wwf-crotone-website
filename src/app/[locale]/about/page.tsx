import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { SITE } from "@/lib/site";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/about` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/about`
    }
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-5">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-12 leading-relaxed">{t("intro")}</p>

      <section className="grid lg:grid-cols-2 gap-10 mb-14 items-start">
        <div>
          <h2 className="text-2xl md:text-3xl mb-4">{t("wwfCrotoneTitle")}</h2>
          <p className="text-ink-2 leading-relaxed">{t("wwfCrotoneBody")}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gallery/photo base wwf crotone.png" alt={t("wwfCrotoneTitle")} className="w-full h-auto" loading="lazy" />
      </section>

      <section className="grid lg:grid-cols-2 gap-10 mb-14 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gallery/ricerca nidi con unità cinofila.png" alt={t("tartamarTitle")} className="w-full h-auto lg:order-1" loading="lazy" />
        <div className="lg:order-2">
          <h2 className="text-2xl md:text-3xl mb-4">{t("tartamarTitle")}</h2>
          <p className="text-ink-2 leading-relaxed">{t("tartamarBody")}</p>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-10 mb-14 items-start">
        <div>
          <h2 className="text-2xl md:text-3xl mb-4">{t("crasTitle")}</h2>
          <p className="text-ink-2 leading-relaxed">{t("crasBody")}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gallery/recupero animali selvatici.png" alt={t("crasTitle")} className="w-full h-auto" loading="lazy" />
      </section>

      <section className="section-sand -mx-6 px-6 py-12 lg:-mx-10 lg:px-10 mb-14">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/gallery/Spiaggia all'interno dell'Area Marina Protetta di Capo Rizzuto.png" alt={t("celaTitle")} className="w-full h-auto" loading="lazy" />
          <div>
            <h2 className="text-2xl md:text-3xl mb-4">{t("celaTitle")}</h2>
            <p className="text-ink-2 leading-relaxed">{t("celaBody")}</p>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <h2 className="text-2xl md:text-3xl mb-4">{t("vergariTitle")}</h2>
          <p className="text-ink-2 leading-relaxed mb-4">{t("vergariBody")}</p>
          <a href={SITE.vergari} target="_blank" rel="noopener noreferrer" className="cta-text">
            {t("vergariLink")} <ExternalLink size={16} />
          </a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gallery/escursione a Mesoraca con le conche e riserva protetta.png" alt={t("vergariTitle")} className="w-full h-auto" loading="lazy" />
      </section>
    </div>
  );
}