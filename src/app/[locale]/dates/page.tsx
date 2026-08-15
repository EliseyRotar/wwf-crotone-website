import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/config/site";
import { Download } from "lucide-react";
import FaqAccordion from "@/components/ui/FaqAccordion";
import { getTurnStatus, fmtDateShort } from "@/lib/turns";
import LiveAvailability from "@/components/features/LiveAvailability";

const BookingForm = nextDynamic(() => import("@/components/features/BookingForm"), {
  loading: () => <div className="card max-w-3xl"><div className="card-body animate-pulse h-96" /></div>
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dates" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: { canonical: `${baseUrl}/${locale}/dates` },
    openGraph: {
      title: `${t("seoTitle")} · WWF Crotone`,
      description: t("seoDescription"),
      url: `${baseUrl}/${locale}/dates`,
      type: "website",
      locale: locale === "it" ? "it_IT" : "en_US",
      siteName: "WWF Crotone"
    },
    twitter: {
      card: "summary_large_image",
      title: t("seoTitle"),
      description: t("seoDescription")
    }
  };
}

export const dynamic = "force-dynamic";

export default async function DatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dates");
  const tC = await getTranslations("Common");
  const tFaq = await getTranslations("Faq");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const turni = await prisma.turno.findMany({
    where: { isActive: true },
    orderBy: { number: "asc" },
    // C-07: atomic counter is the source of truth; the groupBy below
    // only catches drift in legacy data.
    select: { id: true, number: true, startDate: true, endDate: true, capacity: true, bookedCount: true }
  });

  const turnIds = turni.map((t) => t.id);
  const counts = await prisma.iscrizione.groupBy({
    by: ["turnoId"],
    where: { turnoId: { in: turnIds }, status: { notIn: ["cancelled"] } },
    _count: { id: true }
  });
  const countMap = new Map(counts.map((c) => [c.turnoId, c._count.id]));

  const includedList = (await t.raw("includedList")) as string[];
  const inlineFaqs = ((await tFaq.raw("items")) as { q: string; a: string }[]).slice(0, 5);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tNav("home"), item: `${baseUrl}/${loc}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `${baseUrl}/${loc}/dates` }
    ]
  };

  return (
    <div className="container section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-5">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-10 leading-relaxed">{t("intro")}</p>

      <section className="mb-16" aria-label={t("campiTitle")}>
        <h2 className="text-2xl md:text-3xl mb-6">{t("campiTitle")}</h2>
        <LiveAvailability
          initial={turni.map((t) => ({
            id: t.id,
            number: t.number,
            capacity: t.capacity,
            booked: Math.max(t.bookedCount ?? 0, countMap.get(t.id) ?? 0),
            isPast: t.endDate.getTime() < Date.now()
          }))}
        />
        <div id="campi" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {turni.map((turno) => {
            const booked = Math.max(turno.bookedCount ?? 0, countMap.get(turno.id) ?? 0);
            const status = getTurnStatus(booked, turno.capacity, turno.endDate);
            const tagClass =
              status === "past" ? "tag-grey" : status === "available" ? "tag-green" : status === "few" ? "tag-orange" : "tag-red";
            const labelText =
              status === "past" ? (loc === "it" ? "Concluso" : "Ended")
              : status === "available" ? tC("available")
              : status === "few" ? tC("few")
              : tC("full");
            return (
              <Link
                key={turno.id}
                href={`#form`}
                className={`card hover:shadow-lg transition-shadow ${status === "past" ? "opacity-60" : "cursor-pointer"}`}
              >
                <div className="card-body">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="tag tag-green">{tC("field")} {turno.number}</span>
                    <span className={`tag ${tagClass}`}>{labelText}</span>
                  </div>
                  <p className="font-head text-xl">
                    {fmtDateShort(turno.startDate, loc)} – {fmtDateShort(turno.endDate, loc)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section-sand -mx-6 px-6 py-10 lg:-mx-10 lg:px-10 mb-16">
        <h2 className="text-2xl md:text-3xl mb-3">{t("costTitle")}</h2>
        <p className="text-ink-2 mb-6 max-w-3xl leading-relaxed">{t("costBody")}</p>
        <div className="grid md:grid-cols-2 gap-8 mb-6">
          <div>
            <p className="text-sm uppercase tracking-cta text-ink-grey mb-1">{t("ibanLabel")}</p>
            <p className="font-mono text-base break-all">{t("ibanValue")}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-cta text-ink-grey mb-1">{t("causaleLabel")}</p>
            <p className="text-base">{t("causaleValue")}</p>
          </div>
        </div>
        <p className="text-sm text-ink-2 mb-6 max-w-3xl">{t("depositBody")}</p>

        <div className="mb-6 p-5 bg-wwf-green/5 border-l-4 border-wwf-green rounded-r-lg">
          <h3 className="text-lg mb-2 text-wwf-green-dark font-bold">{t("discountTitle")}</h3>
          <p className="text-ink-2 mb-3 leading-relaxed">{t("discountBody")}</p>
          <ul className="space-y-2 mb-3">
            <li className="flex items-center gap-2 text-ink-2">
              <span className="text-wwf-green font-bold">✓</span> {t("discountWeek2")}
            </li>
            <li className="flex items-center gap-2 text-ink-2">
              <span className="text-wwf-green font-bold">✓</span> {t("discountWeek3plus")}
            </li>
          </ul>
          <p className="text-sm text-ink-grey italic">{t("discountExample")}</p>
        </div>

        <h3 className="text-lg mb-3">{t("includedTitle")}</h3>
        <ul className="grid sm:grid-cols-2 gap-2 max-w-3xl">
          {includedList.map((item, i) => (
            <li key={i} className="flex gap-2 text-ink-2">
              <span className="text-wwf-green font-bold">✓</span> {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="form" className="mb-16 scroll-mt-20" aria-label={t("formTitle")}>
        <h2 className="text-2xl md:text-3xl mb-6">{t("formTitle")}</h2>
        <BookingForm
          turni={turni.map((t_) => ({
            id: t_.id,
            number: t_.number,
            start: t_.startDate,
            end: t_.endDate,
            capacity: t_.capacity,
            booked: countMap.get(t_.id) ?? 0,
            isPast: t_.endDate.getTime() < Date.now()
          }))}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-xl md:text-2xl mb-4">{t("faqTitle")}</h2>
        <div className="max-w-3xl">
          <FaqAccordion items={inlineFaqs} />
        </div>
      </section>

      <section className="text-center">
        <a href={SITE.brochure} className="btn btn-outline">
          <Download size={18} /> {t("downloadBrochure")}
        </a>
      </section>
    </div>
  );
}
