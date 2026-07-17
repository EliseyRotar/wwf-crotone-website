import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { Download } from "lucide-react";
import BookingForm from "@/components/BookingForm";
import FaqAccordion from "@/components/FaqAccordion";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dates" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/dates` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/dates`
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
    orderBy: { number: "asc" }
  });

  const counts = await Promise.all(
    turni.map(async (turno) => ({
      id: turno.id,
      count: await prisma.iscrizione.count({
        where: { turnoId: turno.id, status: { notIn: ["cancelled"] } }
      })
    }))
  );
  const countMap = new Map(counts.map((c) => [c.id, c.count]));

  const includedList = (await t.raw("includedList")) as string[];
  const inlineFaqs = ((await tFaq.raw("items")) as { q: string; a: string }[]).slice(0, 5);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "short" });

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-5">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-10 leading-relaxed">{t("intro")}</p>

      <section className="mb-16" aria-label={t("turnsTitle")}>
        <h2 className="text-2xl md:text-3xl mb-6">{t("turnsTitle")}</h2>
        <div id="turns" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turni.map((turno) => {
            const booked = countMap.get(turno.id) ?? 0;
            const free = turno.capacity - booked;
            const now = new Date();
            const isPast = turno.endDate.getTime() < now.getTime();
            const status: "available" | "few" | "full" | "past" =
              isPast ? "past" : free <= 0 ? "full" : free <= 4 ? "few" : "available";
            const tagClass =
              status === "past" ? "tag-grey" : status === "available" ? "tag-green" : status === "few" ? "tag-orange" : "tag-red";
            const labelText =
              status === "past" ? (loc === "it" ? "Concluso" : "Ended")
              : status === "available" ? tC("available")
              : status === "few" ? tC("few")
              : tC("full");
            return (
              <div key={turno.id} className={`card ${isPast ? "opacity-60" : ""}`}>
                <div className="card-body">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="tag tag-green">{tC("field")} {turno.number}</span>
                    <span className={`tag ${tagClass}`}>{labelText}</span>
                  </div>
                  <p className="font-head text-xl">
                    {fmtDate(turno.startDate)} – {fmtDate(turno.endDate)}
                  </p>
                </div>
              </div>
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