import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import PastCampsMap from "@/components/features/PastCampsMapClient";
import { SITE } from "@/config/site";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/about` },
    openGraph: { title: `${t("title")} · WWF Crotone`, description: t("intro"), url: `${baseUrl}/${locale}/about` }
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tNav("home"), item: `${baseUrl}/${loc}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `${baseUrl}/${loc}/about` }
    ]
  };

  return (
    <div className="container section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="mb-6">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-16 leading-relaxed">{t("intro")}</p>

      <section className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
        <div>
          <h2 className="mb-4">{t("wwfCrotoneTitle")}</h2>
          <p className="text-ink-2 leading-relaxed text-lg">{t("wwfCrotoneBody")}</p>
        </div>
        <Image
          src="/images/gallery/photo_base_wwf_crotone.png"
          alt={t("wwfCrotoneTitle")}
          width={1200}
          height={800}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-auto rounded-xl shadow-lg"
          loading="lazy"
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
        <Image
          src="/images/gallery/ricerca_nidi_con_unita_cinofila.png"
          alt={t("tartamarTitle")}
          width={1200}
          height={800}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-auto rounded-xl shadow-lg lg:order-1"
          loading="lazy"
        />
        <div className="lg:order-2">
          <h2 className="mb-4">{t("tartamarTitle")}</h2>
          <p className="text-ink-2 leading-relaxed text-lg">{t("tartamarBody")}</p>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
        <div>
          <h2 className="mb-4">{t("crasTitle")}</h2>
          <p className="text-ink-2 leading-relaxed text-lg">{t("crasBody")}</p>
        </div>
        <Image
          src="/images/gallery/recupero_animali_selvatici.png"
          alt={t("crasTitle")}
          width={1200}
          height={800}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-auto rounded-xl shadow-lg"
          loading="lazy"
        />
      </section>

      <section className="section-sand -mx-6 px-6 py-16 lg:-mx-10 lg:px-10 mb-20 rounded-2xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Image
            src="/images/gallery/Spiaggia_allinterno_dellArea_Marina_Protetta_di_Capo_Rizzuto.png"
            alt={t("celaTitle")}
            width={1200}
            height={800}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="w-full h-auto rounded-xl shadow-lg"
            loading="lazy"
          />
          <div>
            <h2 className="mb-4">{t("celaTitle")}</h2>
            <p className="text-ink-2 leading-relaxed text-lg">{t("celaBody")}</p>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="mb-4">{t("vergariTitle")}</h2>
          <p className="text-ink-2 leading-relaxed text-lg mb-4">{t("vergariBody")}</p>
          <a href={SITE.vergari} target="_blank" rel="noopener noreferrer" className="cta-text">
            {t("vergariLink")} <ExternalLink size={16} />
          </a>
        </div>
        <Image
          src="/images/gallery/escursione_a_Mesoraca_con_le_conche_e_riserva_protetta.png"
          alt={t("vergariTitle")}
          width={1200}
          height={800}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-auto rounded-xl shadow-lg"
          loading="lazy"
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
        <div>
          <h2 className="mb-4">{t("crtmTitle")}</h2>
          <p className="text-ink-2 leading-relaxed text-lg">{t("crtmBody")}</p>
        </div>
        <Image
          src="/images/gallery/tartaruga_nel_Centro_Recupero_Tartarughe_Marine.png"
          alt={t("crtmTitle")}
          width={1200}
          height={800}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-auto rounded-xl shadow-lg"
          loading="lazy"
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
        <Image
          src="/images/gallery/drone_shot_beach_plus_sea.png"
          alt={t("aquariumTitle")}
          width={1200}
          height={800}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-auto rounded-xl shadow-lg lg:order-1"
          loading="lazy"
        />
        <div className="lg:order-2">
          <h2 className="mb-4">{t("aquariumTitle")}</h2>
          <p className="text-ink-2 leading-relaxed text-lg">{t("aquariumBody")}</p>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="mb-3">{t("mapTitle")}</h2>
        <p className="text-ink-2 max-w-3xl mb-6 leading-relaxed">{t("mapBody")}</p>
        <PastCampsMap locale={loc} />
      </section>
    </div>
  );
}
