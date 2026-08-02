import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { SITE } from "@/config/site";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Activities" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/activities` },
    openGraph: { title: `${t("title")} · WWF Crotone`, description: t("intro"), url: `${baseUrl}/${locale}/activities` }
  };
}

export default async function ActivitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Activities");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const mainList = (await t.raw("mainList")) as string[];
  const secondaryList = (await t.raw("secondaryList")) as string[];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tNav("home"), item: `${baseUrl}/${loc}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `${baseUrl}/${loc}/activities` }
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

      <section className="mb-20">
        <div className="relative w-full h-[28rem] mb-8 rounded-xl shadow-lg overflow-hidden">
          <Image
            src="/images/gallery/tracce_Caretta_caretta.png"
            alt={t("monitoringTitle")}
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
            loading="lazy"
          />
        </div>
        <h2 className="mb-4">{t("monitoringTitle")}</h2>
        <p className="text-ink-2 leading-relaxed max-w-3xl text-lg">{t("monitoringBody")}</p>
      </section>

      <section className="mb-20">
        <h2 className="mb-8">{t("mainTitle")}</h2>
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl">
          {mainList.map((item, i) => (
            <div key={i} className="flex gap-4 border-l-4 border-wwf-green pl-5 py-3 bg-surface rounded-r-lg">
              <span className="font-head text-3xl text-wwf-green shrink-0 leading-none">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-ink-2 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-sand -mx-6 px-6 py-16 lg:-mx-10 lg:px-10 rounded-2xl">
        <h2 className="mb-4">{t("secondaryTitle")}</h2>
        <p className="text-ink-2 mb-8 max-w-2xl text-lg">{t("secondaryIntro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {secondaryList.map((item, i) => {
            const isVergari = item.toLowerCase().includes("vergari");
            return (
              <div key={i} className="card">
                <div className="card-body">
                  {isVergari ? (
                    <a href={SITE.vergari} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-wwf-green inline-flex items-start gap-2">
                      <span>{item}</span><ExternalLink size={14} className="mt-1 shrink-0" />
                    </a>
                  ) : (
                    <p className="text-ink-2">{item}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-20">
        <h2 className="mb-3">{t("eventsTitle")}</h2>
        <p className="text-ink-2 mb-8 max-w-3xl text-lg leading-relaxed">{t("eventsIntro")}</p>
        <div className="grid md:grid-cols-3 gap-6">
          <article className="card card-feature">
            <div className="card-body">
              <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center mb-4 text-2xl">🌍</div>
              <h3 className="text-xl mb-3">{t("earthHourTitle")}</h3>
              <p className="text-ink-2 leading-relaxed text-sm">{t("earthHourBody")}</p>
            </div>
          </article>
          <article className="card card-feature">
            <div className="card-body">
              <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center mb-4 text-2xl">🌿</div>
              <h3 className="text-xl mb-3">{t("urbanNatureTitle")}</h3>
              <p className="text-ink-2 leading-relaxed text-sm">{t("urbanNatureBody")}</p>
            </div>
          </article>
          <article className="card card-feature">
            <div className="card-body">
              <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center mb-4 text-2xl">🏞️</div>
              <h3 className="text-xl mb-3">{t("primaveraOasiTitle")}</h3>
              <p className="text-ink-2 leading-relaxed text-sm">{t("primaveraOasiBody")}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section-sand -mx-6 px-6 py-16 lg:-mx-10 lg:px-10 rounded-2xl">
        <h2 className="mb-3">{t("trainingTitle")}</h2>
        <p className="text-ink-2 mb-8 max-w-3xl text-lg leading-relaxed">{t("trainingIntro")}</p>
        <div className="grid lg:grid-cols-3 gap-6">
          <article className="card">
            <div className="card-body">
              <div className="w-10 h-10 rounded-lg bg-wwf-orange/10 flex items-center justify-center mb-3 text-xl">🎓</div>
              <h3 className="text-lg mb-2">{t("internshipTitle")}</h3>
              <p className="text-ink-2 leading-relaxed text-sm">{t("internshipBody")}</p>
            </div>
          </article>
          <article className="card">
            <div className="card-body">
              <div className="w-10 h-10 rounded-lg bg-wwf-orange/10 flex items-center justify-center mb-3 text-xl">📚</div>
              <h3 className="text-lg mb-2">{t("coursesTitle")}</h3>
              <p className="text-ink-2 leading-relaxed text-sm">{t("coursesBody")}</p>
            </div>
          </article>
          <article className="card">
            <div className="card-body">
              <div className="w-10 h-10 rounded-lg bg-wwf-orange/10 flex items-center justify-center mb-3 text-xl">🏫</div>
              <h3 className="text-lg mb-2">{t("pctoTitle")}</h3>
              <p className="text-ink-2 leading-relaxed text-sm">{t("pctoBody")}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
