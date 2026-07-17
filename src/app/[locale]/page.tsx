import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  Turtle,
  HeartPulse,
  Trash2,
  MapPin,
  GraduationCap,
  Plane,
  ArrowRight,
  Download
} from "lucide-react";
import { STATS, SITE } from "@/lib/site";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tC = await getTranslations("Common");
  const loc = locale;

  const fmt = (n: number) => n.toLocaleString(loc === "it" ? "it-IT" : "en-US");

  const stats = [
    { value: `${fmt(STATS.turtles)}+`, label: t("statsTurtles") },
    { value: `${fmt(STATS.nests)}+`, label: t("statsNests") },
    { value: `${fmt(STATS.volunteers)}+`, label: t("statsVolunteers") },
    { value: String(STATS.years), label: t("statsYears") }
  ];

  const activities = [
    { icon: Turtle, it: "Ricerca nidi di Caretta caretta", en: "Search for Caretta caretta nests", img: "/images/gallery/ricerca nidi.png" },
    { icon: HeartPulse, it: "Centro Recupero Tartarughe Marine", en: "Marine Turtle Recovery Center", img: "/images/gallery/tartaruga nel Centro Recupero Tartarughe Marine.png" },
    { icon: Trash2, it: "Pulizia delle spiagge", en: "Beach cleanup", img: "/images/gallery/pulizia spiaggia.png" },
    { icon: MapPin, it: "Recupero animali selvatici", en: "Wildlife rescue", img: "/images/gallery/recupero animali selvatici.png" },
    { icon: GraduationCap, it: "Formazione sulle tartarughe marine", en: "Sea turtle training", img: "/images/gallery/drone shot beach + sea.png" },
    { icon: Plane, it: "Escursioni culturali", en: "Cultural excursions", img: "/images/gallery/Capocolonna.png" }
  ];

  // Fetch real turn data from DB — show 4 preview turns (1, 4, 8, 12)
  const previewNumbers = [1, 4, 8, 12];
  const dbTurni = await prisma.turno.findMany({
    where: { number: { in: previewNumbers }, isActive: true },
    orderBy: { number: "asc" }
  });
  const counts = await Promise.all(
    dbTurni.map(async (turno) => ({
      id: turno.id,
      count: await prisma.iscrizione.count({
        where: { turnoId: turno.id, status: { notIn: ["cancelled"] } }
      })
    }))
  );
  const countMap = new Map(counts.map((c) => [c.id, c.count]));

  const fmtDateShort = (d: Date) =>
    d.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "2-digit" });

  const now = new Date();
  const turns = dbTurni.map((turno) => {
    const booked = countMap.get(turno.id) ?? 0;
    const free = turno.capacity - booked;
    const isPast = turno.endDate.getTime() < now.getTime();
    const status: "available" | "few" | "full" | "past" =
      isPast ? "past" : free <= 0 ? "full" : free <= 4 ? "few" : "available";
    return {
      n: turno.number,
      s: fmtDateShort(turno.startDate),
      e: fmtDateShort(turno.endDate),
      status
    };
  });

  const p = (s: string) => `/${loc}/${s}`;

  return (
    <>
      <section className="hero" aria-label={t("heroTitle")}>
        <div className="hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/gallery/schiusa tartarughe.png"
            alt={loc === "it" ? "Schiusa di tartarughe Caretta caretta" : "Caretta caretta hatching"}
            fetchPriority="high"
          />
        </div>
        <div className="hero-scrim" />
        <div className="hero-content">
          <div className="container">
            <p className="eyebrow text-wwf-green-light mb-3">{t("heroEyebrow")}</p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl mb-5 max-w-4xl">{t("heroTitle")}</h1>
            <p className="text-base md:text-lg text-white/90 max-w-2xl mb-7 leading-relaxed">{t("heroSubtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={p("dates") + "#form"} className="btn btn-primary">
                {t("heroCta")} <ArrowRight size={18} />
              </Link>
              <Link href={p("activities")} className="btn btn-outline text-white border-white hover:bg-white hover:text-ink dark:hover:bg-white dark:hover:text-ink">
                {t("heroCta2")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark" aria-label={t("statsTitle")}>
        <div className="container">
          <h2 className="text-2xl md:text-3xl mb-8 text-center">{t("statsTitle")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="font-head text-4xl md:text-6xl text-wwf-green-light mb-1">{s.value}</p>
                <p className="text-sm uppercase tracking-cta text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-label={t("activitiesTitle")}>
        <div className="container">
          <div className="mb-8 max-w-3xl">
            <p className="eyebrow mb-2">{t("activitiesTitle")}</p>
            <h2 className="text-3xl md:text-4xl mb-3">{t("activitiesTitle")}</h2>
            <p className="text-ink-grey text-lg">{t("activitiesSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activities.map((a, i) => (
              <article key={i} className="card">
                <div className="card-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.img} alt={loc === "it" ? a.it : a.en} loading="lazy" />
                </div>
                <div className="card-body">
                  <a.icon size={28} className="text-wwf-green mb-1" aria-hidden />
                  <h3 className="text-lg leading-tight">{loc === "it" ? a.it : a.en}</h3>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-8">
            <Link href={p("activities")} className="cta-text">
              {t("activitiesCta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-sand" aria-label={t("turnsTitle")}>
        <div className="container">
          <div className="mb-8 max-w-3xl">
            <p className="eyebrow mb-2">{t("turnsTitle")}</p>
            <h2 className="text-3xl md:text-4xl mb-3">{t("turnsTitle")}</h2>
            <p className="text-ink-grey text-lg">{t("turnsSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {turns.map((turn) => {
              const statusColor = turn.status === "past" ? "tag-grey" : turn.status === "full" ? "tag-red" : turn.status === "few" ? "tag-orange" : "tag-green";
              const statusText = turn.status === "past" ? (loc === "it" ? "Concluso" : "Ended") : turn.status === "full" ? tC("full") : turn.status === "few" ? tC("few") : tC("available");
              return (
                <Link key={turn.n} href={p("dates") + "#form"} className="card group">
                  <div className="card-body items-center text-center">
                    <span className="tag tag-green">{tC("field")} {turn.n}</span>
                    <p className="font-head text-2xl">{turn.s} – {turn.e}</p>
                    <span className={`tag ${statusColor}`}>{statusText}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-8">
            <Link href={p("dates") + "#form"} className="cta-text">
              {t("turnsCta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-label={t("storyTitle")}>
        <div className="container grid lg:grid-cols-2 gap-10 items-center">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/gallery/photo base wwf crotone.png" alt={loc === "it" ? "La base di WWF Crotone — C.E.L.A." : "The WWF Crotone base — C.E.L.A."} className="w-full h-auto" loading="lazy" />
          </div>
          <div>
            <p className="eyebrow mb-2">C.E.L.A.</p>
            <h2 className="text-3xl md:text-4xl mb-4">{t("storyTitle")}</h2>
            <p className="text-ink-2 text-lg leading-relaxed mb-6">{t("storyBody")}</p>
            <Link href={p("about")} className="cta-text">
              {t("storyCta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-sand" aria-label={t("testimonialsTitle")}>
        <div className="container">
          <h2 className="text-3xl md:text-4xl mb-8 text-center">{t("testimonialsTitle")}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <blockquote className="card">
              <div className="card-body">
                <p className="text-lg italic text-ink-2 leading-relaxed">
                  {loc === "it"
                    ? "Vedere una tartaruga emergere dalla sabbia all'alba è qualcosa che ti cambia. Tornerò."
                    : "Seeing a turtle emerge from the sand at dawn is something that changes you. I'll be back."}
                </p>
                <footer className="text-sm text-ink-grey mt-3">— {loc === "it" ? "Giulia, volontaria 2024" : "Giulia, volunteer 2024"}</footer>
              </div>
            </blockquote>
            <blockquote className="card">
              <div className="card-body">
                <p className="text-lg italic text-ink-2 leading-relaxed">
                  {loc === "it"
                    ? "Un'esperienza di legalità, ambiente e comunità. Il C.E.L.A. è un luogo speciale."
                    : "An experience of legality, environment and community. The C.E.L.A. is a special place."}
                </p>
                <footer className="text-sm text-ink-grey mt-3">— {loc === "it" ? "Marco, volontario 2023" : "Marco, volunteer 2023"}</footer>
              </div>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="section section-dark text-center" aria-label={t("finalCtaTitle")}>
        <div className="container max-w-3xl">
          <h2 className="text-3xl md:text-5xl mb-4">{t("finalCtaTitle")}</h2>
          <p className="text-white/80 text-lg mb-7">{t("finalCtaBody")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={p("dates") + "#form"} className="btn btn-primary">{t("finalCtaBtn")} <ArrowRight size={18} /></Link>
            <a href={SITE.brochure} className="btn btn-outline text-white border-white hover:bg-white hover:text-ink dark:hover:bg-white dark:hover:text-ink">
              <Download size={18} /> {tC("download")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}