import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/config/site";
import {
  CORE_ACTIVITIES,
  SECONDARY_ACTIVITIES,
  NATIONAL_EVENTS,
  TRAINING_TRACKS,
  mappableActivities
} from "@/config/activities";
import ActivityCard from "@/components/features/ActivityCard";
import ActivitiesMapClient from "@/components/features/ActivitiesMapClient";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Activities" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/activities` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/activities`,
      images: [{ url: "/images/gallery/schiusa_tartarughe.png", width: 1200, height: 630, alt: t("title") }]
    }
  };
}

export default async function ActivitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Activities");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  // Long-form bodies for the detailed cards on this page (parallel to
  // the JSON mainList / secondaryList etc.).
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

  // Match JSON list items to CORE_ACTIVITIES by id so we can render a
  // detailed card with the body text on /activities while keeping the
  // short labels on the home page.
  const coreDetail = CORE_ACTIVITIES.map((a, i) => ({
    ...a,
    body: mainList[i]
  })).filter((x) => x.body);

  const secondaryDetail = SECONDARY_ACTIVITIES.map((a, i) => ({
    ...a,
    body: secondaryList[i]
  })).filter((x) => x.body);

  // Map points: every CORE + SECONDARY activity with a lat/lng.
  const mapPoints = mappableActivities().map((a) => ({
    id: a.id,
    lat: a.lat as number,
    lng: a.lng as number,
    titleIt: a.it,
    titleEn: a.en,
    badgeIt: loc === "it" ? "Attività" : "Activity",
    badgeEn: loc === "it" ? "Attività" : "Activity"
  }));

  const eventBodies: Array<{ title: string; body: string; id: string }> = [
    { id: "earth-hour", title: t("earthHourTitle"), body: t("earthHourBody") },
    { id: "urban-nature", title: t("urbanNatureTitle"), body: t("urbanNatureBody") },
    { id: "primavera-oasi", title: t("primaveraOasiTitle"), body: t("primaveraOasiBody") }
  ];

  const trainingBodies: Array<{ title: string; body: string; id: string }> = [
    { id: "internship", title: t("internshipTitle"), body: t("internshipBody") },
    { id: "courses", title: t("coursesTitle"), body: t("coursesBody") },
    { id: "pcto", title: t("pctoTitle"), body: t("pctoBody") }
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <Image
            src="/images/gallery/schiusa_tartarughe.png"
            alt={loc === "it" ? "Schiusa di tartarughe marine" : "Sea turtle hatching"}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="hero-scrim" />
        <div className="hero-content">
          <div className="container">
            <nav className="breadcrumb text-white/80 mb-4" aria-label="breadcrumb">
              <ol>
                <li><a href={`/${loc}`} className="text-white/80 hover:text-white">{tNav("home")}</a></li>
                <li className="text-white" aria-current="page">{t("title")}</li>
              </ol>
            </nav>
            <p className="eyebrow text-wwf-green-light mb-4">{loc === "it" ? "Le attività del campo" : "Camp activities"}</p>
            <h1 className="mb-6 max-w-4xl">{t("title")}</h1>
            <p className="text-base md:text-lg text-white/85 max-w-3xl leading-relaxed">{t("intro")}</p>
          </div>
        </div>
      </section>

      {/* ENVIRONMENTAL MONITORING — full-bleed image + text */}
      <section className="section">
        <div className="container">
          <div className="mb-12 max-w-3xl">
            <p className="eyebrow mb-3">{t("monitoringTitle")}</p>
            <h2 className="mb-4">{t("monitoringTitle")}</h2>
          </div>
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-3 relative overflow-hidden rounded-xl shadow-lg order-2 lg:order-1" style={{ aspectRatio: "16/10" }}>
              <Image
                src="/images/gallery/tracce_Caretta_caretta.png"
                alt={t("monitoringTitle")}
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
            </div>
            <div className="lg:col-span-2 order-1 lg:order-2">
              <p className="text-ink-2 leading-relaxed text-lg">{t("monitoringBody")}</p>
              <Link href={`/${loc}/about#map`} className="cta-text mt-6 inline-flex">
                {loc === "it" ? "Vedi dove operiamo" : "See where we operate"} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TARTAMAR PROJECT — dark section, image right */}
      <section className="section section-dark">
        <div className="container">
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-2">
              <p className="eyebrow text-wwf-green-light mb-3">{t("tartamarTitle")}</p>
              <h2 className="mb-5 text-white">{t("tartamarTitle")}</h2>
              <p className="text-white/80 leading-relaxed text-lg">{t("tartamarBody")}</p>
            </div>
            <div className="lg:col-span-3 relative overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: "16/10" }}>
              <Image
                src="/images/gallery/ricerca_nidi_con_unita_cinofila.png"
                alt={t("tartamarTitle")}
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CORE ACTIVITIES — feature cards grid */}
      <section className="section">
        <div className="container">
          <div className="mb-12 max-w-3xl">
            <p className="eyebrow mb-3">{t("mainTitle")}</p>
            <h2 className="mb-4">{t("mainTitle")}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">{t("intro")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreDetail.map((a) => (
              <ActivityCard
                key={a.id}
                a={a}
                locale={loc as "it" | "en"}
                variant="detailed"
                body={a.body}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECONDARY ACTIVITIES — sand section */}
      <section className="section section-sand -mx-6 px-6 py-16 lg:-mx-10 lg:px-10 rounded-2xl">
        <div className="container">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow mb-3">{t("secondaryTitle")}</p>
            <h2 className="mb-4">{t("secondaryTitle")}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">{t("secondaryIntro")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {secondaryDetail.map((a) => (
              <ActivityCard
                key={a.id}
                a={a}
                locale={loc as "it" | "en"}
                variant="detailed"
                body={a.body}
                cta={a.href ? { label: loc === "it" ? "Visita il sito" : "Visit site", href: a.href } : undefined}
              />
            ))}
          </div>
        </div>
      </section>

      {/* WWF ITALIA NATIONAL EVENTS */}
      <section className="section">
        <div className="container">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow mb-3">{t("eventsTitle")}</p>
            <h2 className="mb-4">{t("eventsTitle")}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">{t("eventsIntro")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {NATIONAL_EVENTS.map((a, i) => {
              const eb = eventBodies[i];
              return (
                <ActivityCard
                  key={a.id}
                  a={a}
                  locale={loc as "it" | "en"}
                  variant="detailed"
                  body={eb?.body}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* INTERACTIVE MAP — shows where the activities happen */}
      <section className="section section-sand -mx-6 px-6 py-16 lg:-mx-10 lg:px-10 rounded-2xl">
        <div className="container">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow mb-3">{loc === "it" ? "Dove operiamo" : "Where we operate"}</p>
            <h2 className="mb-4">{loc === "it" ? "La mappa delle attività" : "Activity map"}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">
              {loc === "it"
                ? "Le attività si svolgono tra Crotone, l'Area Marina Protetta di Capo Rizzuto, l'entroterra mesoracese e la costa ionica. Clicca un marcatore per scoprire il punto, oppure usa i tag qui sotto per volare sulla mappa."
                : "Activities take place across Crotone, the Capo Rizzuto Marine Protected Area, the Mesoraca hinterland and the Ionian coast. Click a marker to explore, or use the chips below to fly the camera."}
            </p>
          </div>
          <ActivitiesMapClient points={mapPoints} locale={loc} center={[39.0, 17.0]} zoom={9} />
          <p className="text-xs text-ink-grey mt-3 text-center flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <a
              href={`https://www.openstreetmap.org/?mlat=39.0&mlon=17.0#map=10/39.0/17.0`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wwf-green underline"
            >
              {loc === "it" ? "Apri in OpenStreetMap" : "Open in OpenStreetMap"}
            </a>
            <span className="text-ink-grey/40">·</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=WWF+Crotone+San+Leonardo+di+Cutro+KR`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wwf-green underline"
            >
              {loc === "it" ? "Apri in Google Maps" : "Open in Google Maps"}
            </a>
          </p>
        </div>
      </section>

      {/* TRAINING / PCTO */}
      <section className="section">
        <div className="container">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow mb-3">{t("trainingTitle")}</p>
            <h2 className="mb-4">{t("trainingTitle")}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">{t("trainingIntro")}</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {TRAINING_TRACKS.map((a, i) => {
              const tb = trainingBodies[i];
              return (
                <ActivityCard
                  key={a.id}
                  a={a}
                  locale={loc as "it" | "en"}
                  variant="detailed"
                  body={tb?.body}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section section-dark text-center">
        <div className="container max-w-3xl">
          <p className="eyebrow text-wwf-green-light mb-3">{loc === "it" ? "Pronto a partire?" : "Ready to go?"}</p>
          <h2 className="mb-5 text-white">{loc === "it" ? "Iscriviti ai turni 2026" : "Apply for the 2026 camps"}</h2>
          <p className="text-white/80 mb-8 text-lg leading-relaxed">
            {loc === "it"
              ? "Tutte le attività che hai letto si svolgono nei nostri 12 turni tra marzo e settembre. Trova le date e prenota."
              : "Everything you just read happens during our 12 turns between March and September. Find the dates and apply."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/${loc}/dates`} className="btn btn-primary text-base px-8 py-4">
              {loc === "it" ? "Vedi i turni" : "See dates"} <ArrowRight size={18} />
            </Link>
            <a href={SITE.brochure} className="btn btn-outline text-white border-white/60 hover:bg-white hover:text-ink dark:hover:bg-white dark:hover:text-ink">
              {loc === "it" ? "Scarica la brochure" : "Download brochure"}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}