import Link from "next/link";
import Image from "next/image";
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
import { STATS, SITE } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { getTurnStatus, fmtDateShort } from "@/lib/turns";
import InstagramFeed from "@/components/features/InstagramFeed";

export const revalidate = 60;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wwfcrotone.it";

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
    { icon: Turtle, it: "Ricerca nidi di Caretta caretta", en: "Search for Caretta caretta nests", img: "/images/gallery/ricerca_nidi.png" },
    { icon: HeartPulse, it: "Centro Recupero Tartarughe Marine", en: "Marine Turtle Recovery Center", img: "/images/gallery/tartaruga_nel_Centro_Recupero_Tartarughe_Marine.png" },
    { icon: Trash2, it: "Pulizia delle spiagge", en: "Beach cleanup", img: "/images/gallery/pulizia_spiaggia.png" },
    { icon: MapPin, it: "Recupero animali selvatici", en: "Wildlife rescue", img: "/images/gallery/recupero_animali_selvatici.png" },
    { icon: GraduationCap, it: "Formazione sulle tartarughe marine", en: "Sea turtle training", img: "/images/gallery/drone_shot_beach_plus_sea.png" },
    { icon: Plane, it: "Escursioni culturali", en: "Cultural excursions", img: "/images/gallery/Capocolonna.png" }
  ];

  const previewNumbers = [1, 4, 8, 12];
  const dbTurni = await prisma.turno.findMany({
    where: { number: { in: previewNumbers }, isActive: true },
    orderBy: { number: "asc" },
    // C-07: use the atomic counter, with the legacy groupBy as a safety net.
    select: { id: true, number: true, startDate: true, endDate: true, capacity: true, bookedCount: true }
  });

  const turnIds = dbTurni.map((t) => t.id);
  const counts = await prisma.iscrizione.groupBy({
    by: ["turnoId"],
    where: { turnoId: { in: turnIds }, status: { notIn: ["cancelled"] } },
    _count: { id: true }
  });
  const countMap = new Map(counts.map((c) => [c.turnoId, c._count.id]));

  const turns = dbTurni.map((turno) => {
    const booked = Math.max(turno.bookedCount ?? 0, countMap.get(turno.id) ?? 0);
    const status = getTurnStatus(booked, turno.capacity, turno.endDate);
    return {
      n: turno.number,
      s: fmtDateShort(turno.startDate, loc),
      e: fmtDateShort(turno.endDate, loc),
      status
    };
  });

  const p = (s: string) => `/${loc}/${s}`;

  return (
    <>
      <section className="hero" aria-label={t("heroTitle")}>
        <div className="hero-bg">
          <Image
            src="/images/gallery/schiusa_tartarughe.png"
            alt={loc === "it" ? "Schiusa di tartarughe Caretta caretta" : "Caretta caretta hatching"}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="hero-scrim" />
        <div className="hero-content">
          <div className="container">
            <p className="eyebrow text-wwf-green-light mb-4 animate-in">{t("heroEyebrow")}</p>
            <h1 className="mb-6 max-w-4xl animate-in animate-in-delay-1">{t("heroTitle")}</h1>
            <p className="text-base md:text-lg text-white/85 max-w-2xl mb-8 leading-relaxed animate-in animate-in-delay-2">{t("heroSubtitle")}</p>
            <div className="flex flex-wrap gap-3 animate-in animate-in-delay-3">
              <Link href={p("dates") + "#form"} className="btn btn-primary text-base px-8 py-4">
                {t("heroCta")} <ArrowRight size={18} />
              </Link>
              <Link href={p("activities")} className="btn btn-outline text-white border-white/60 hover:bg-white hover:text-ink dark:hover:bg-white dark:hover:text-ink">
                {t("heroCta2")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark" aria-label={t("statsTitle")}>
        <div className="container">
          <h2 className="text-center mb-12 text-white/90">{t("statsTitle")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="stat-number mb-2">{s.value}</p>
                <p className="text-sm font-semibold tracking-widest uppercase text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-label={t("activitiesTitle")}>
        <div className="container">
          <div className="mb-12 max-w-3xl">
            <p className="eyebrow mb-3">{t("activitiesTitle")}</p>
            <h2 className="mb-4">{t("activitiesTitle")}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">{t("activitiesSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((a, i) => (
              <article key={i} className="card card-feature group">
                <div className="card-img">
                  <Image
                    src={a.img}
                    alt={loc === "it" ? a.it : a.en}
                    width={800}
                    height={600}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    loading="lazy"
                  />
                </div>
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0">
                      <a.icon size={20} className="text-wwf-green" aria-hidden />
                    </div>
                    <h3 className="text-lg leading-snug">{loc === "it" ? a.it : a.en}</h3>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-10">
            <Link href={p("activities")} className="cta-text">
              {t("activitiesCta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-sand" aria-label={t("campiTitle")}>
        <div className="container">
          <div className="mb-12 max-w-3xl">
            <p className="eyebrow mb-3">{t("campiTitle")}</p>
            <h2 className="mb-4">{t("campiTitle")}</h2>
            <p className="text-ink-grey text-lg leading-relaxed">{t("campiSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {turns.map((turn) => {
              const statusColor = turn.status === "past" ? "tag-grey" : turn.status === "full" ? "tag-red" : turn.status === "few" ? "tag-orange" : "tag-green";
              const statusText = turn.status === "past" ? (loc === "it" ? "Concluso" : "Ended") : turn.status === "full" ? tC("full") : turn.status === "few" ? tC("few") : tC("available");
              return (
                <Link key={turn.n} href={p("dates") + "#form"} className="card group">
                  <div className="card-body items-center text-center py-8">
                    <span className="tag tag-green mb-3">{tC("field")} {turn.n}</span>
                    <p className="font-head text-2xl tracking-tight mb-3">{turn.s} – {turn.e}</p>
                    <span className={`tag ${statusColor}`}>{statusText}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-10">
            <Link href={p("dates") + "#form"} className="cta-text">
              {t("campiCta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-label={t("storyTitle")}>
        <div className="container grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <Image
              src="/images/gallery/photo_base_wwf_crotone.png"
              alt={loc === "it" ? "La base di WWF Crotone — C.E.L.A." : "The WWF Crotone base — C.E.L.A."}
              width={1200}
              height={800}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="w-full h-auto rounded-xl shadow-lg"
              loading="lazy"
            />
            <div className="absolute -bottom-4 -right-4 bg-wwf-green text-white px-5 py-3 rounded-lg shadow-lg">
              <p className="font-head text-2xl leading-none">C.E.L.A.</p>
              <p className="text-xs text-white/70">{loc === "it" ? "Bene confiscato" : "Confiscated property"}</p>
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">C.E.L.A.</p>
            <h2 className="mb-5">{t("storyTitle")}</h2>
            <p className="text-ink-2 text-lg leading-relaxed mb-6">{t("storyBody")}</p>
            <Link href={p("about")} className="cta-text">
              {t("storyCta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-sand" aria-label={t("testimonialsTitle")}>
        <div className="container">
          <h2 className="text-center mb-12">{t("testimonialsTitle")}</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <blockquote className="card border-l-4 border-l-wwf-green">
              <div className="card-body">
                <p className="text-lg italic text-ink-2 leading-relaxed">
                  {loc === "it"
                    ? "Vedere una tartaruga emergere dalla sabbia all'alba è qualcosa che ti cambia. Tornerò."
                    : "Seeing a turtle emerge from the sand at dawn is something that changes you. I'll be back."}
                </p>
                <footer className="text-sm text-ink-grey mt-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-wwf-green/20 flex items-center justify-center text-wwf-green font-bold text-xs">G</div>
                  {loc === "it" ? "Giulia, volontaria 2024" : "Giulia, volunteer 2024"}
                </footer>
              </div>
            </blockquote>
            <blockquote className="card border-l-4 border-l-wwf-orange">
              <div className="card-body">
                <p className="text-lg italic text-ink-2 leading-relaxed">
                  {loc === "it"
                    ? "Un'esperienza di legalità, ambiente e comunità. Il C.E.L.A. è un luogo speciale."
                    : "An experience of legality, environment and community. The C.E.L.A. is a special place."}
                </p>
                <footer className="text-sm text-ink-grey mt-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-wwf-orange/20 flex items-center justify-center text-wwf-orange font-bold text-xs">M</div>
                  {loc === "it" ? "Marco, volontario 2023" : "Marco, volunteer 2023"}
                </footer>
              </div>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="section section-dark text-center" aria-label={t("finalCtaTitle")}>
        <div className="container max-w-3xl">
          <h2 className="mb-5 text-white">{t("finalCtaTitle")}</h2>
          <p className="text-white/70 text-lg mb-8 leading-relaxed">{t("finalCtaBody")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={p("dates") + "#form"} className="btn btn-primary text-base px-8 py-4">{t("finalCtaBtn")} <ArrowRight size={18} /></Link>
            <a href={SITE.brochure} className="btn btn-outline text-white border-white/60 hover:bg-white hover:text-ink dark:hover:bg-white dark:hover:text-ink">
              <Download size={18} /> {tC("download")}
            </a>
          </div>
        </div>
      </section>

      {/* LocalBusiness JSON-LD — helps Google show our address, phone,
          and hours on the Knowledge Panel and Maps results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": `${baseUrl}/#localbusiness`,
            name: SITE.legalName,
            alternateName: "WWF Crotone",
            url: baseUrl,
            telephone: SITE.phoneField,
            email: SITE.email,
            image: `${baseUrl}/logos/wwf.png`,
            logo: `${baseUrl}/logos/wwf.png`,
            description:
              loc === "it"
                ? "Sezione locale di WWF Italia ETS. Campi di volontariato ambientale per la tutela delle tartarughe marine Caretta caretta sull'AMP Capo Rizzuto, Calabria."
                : "Local branch of WWF Italia ETS. Environmental volunteer camps protecting Caretta caretta sea turtles in the Capo Rizzuto Marine Protected Area, Calabria, Italy.",
            address: {
              "@type": "PostalAddress",
              streetAddress: "Località San Leonardo di Cutro, snc",
              addressLocality: "Cutro",
              addressRegion: "KR",
              postalCode: "88842",
              addressCountry: "IT"
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: 38.9403,
              longitude: 16.9497
            },
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                opens: "09:00",
                closes: "18:00"
              }
            ],
            priceRange: "€€",
            sameAs: [SITE.facebook, SITE.instagram, SITE.googleBusiness],
            parentOrganization: {
              "@type": "NGO",
              name: "WWF Italia ETS",
              url: "https://www.wwf.it"
            }
          })
        }}
      />

      <InstagramFeed />
    </>
  );
}
