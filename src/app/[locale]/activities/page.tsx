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
  const t = await getTranslations({ locale, namespace: "Activities" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/activities` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/activities`
    }
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

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-5">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-12 leading-relaxed">{t("intro")}</p>

      <section className="mb-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gallery/tracce Caretta caretta.png" alt={t("monitoringTitle")} className="w-full h-[28rem] object-cover mb-6" loading="lazy" />
        <h2 className="text-2xl md:text-3xl mb-4">{t("monitoringTitle")}</h2>
        <p className="text-ink-2 leading-relaxed max-w-3xl">{t("monitoringBody")}</p>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl md:text-3xl mb-6">{t("mainTitle")}</h2>
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl">
          {mainList.map((item, i) => (
            <div key={i} className="flex gap-3 border-l-4 border-wwf-green pl-4 py-2 bg-surface">
              <span className="font-head text-2xl text-wwf-green shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-ink-2 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-sand -mx-6 px-6 py-12 lg:-mx-10 lg:px-10 mb-14">
        <h2 className="text-2xl md:text-3xl mb-3">{t("secondaryTitle")}</h2>
        <p className="text-ink-2 mb-6 max-w-2xl">{t("secondaryIntro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
}