import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Heart, ArrowRight, Shield, Users, Leaf } from "lucide-react";
import { SITE } from "@/config/site";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Support" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/support` },
    openGraph: { title: `${t("title")} · WWF Crotone`, description: t("intro"), url: `${baseUrl}/${locale}/support` }
  };
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Support");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const ways = [
    {
      icon: Users,
      title: loc === "it" ? "Diventa Volontario" : "Become a Volunteer",
      description: loc === "it"
        ? "Partecipa ai nostri campi estivi di volontariato ambientale. Un'esperienza unica tra natura, mare e tartarughe."
        : "Join our summer environmental volunteer camps. A unique experience among nature, sea and turtles.",
      href: `/${loc}/dates#form`,
      cta: loc === "it" ? "Iscriviti ora" : "Sign up now"
    },
    {
      icon: Heart,
      title: loc === "it" ? "Fai una Donazione" : "Make a Donation",
      description: loc === "it"
        ? "Sostieni le nostre attività di conservazione con una donazione. Ogni contributo aiuta a proteggere le tartarughe marine e l'ambiente."
        : "Support our conservation activities with a donation. Every contribution helps protect sea turtles and the environment.",
      href: `#donate`,
      cta: loc === "it" ? "Dona ora" : "Donate now"
    },
    {
      icon: Shield,
      title: loc === "it" ? "Diventa Socio WWF" : "Become a WWF Member",
      description: loc === "it"
        ? "Unisciti al WWF Italia e sostieni la più grande organizzazione per la conservazione della natura."
        : "Join WWF Italy and support the largest nature conservation organization.",
      href: "https://www.wwf.it/sostienimi/diventa-socio/",
      cta: loc === "it" ? "Scopri come" : "Learn more",
      external: true
    },
    {
      icon: Leaf,
      title: loc === "it" ? "Adotta una Tartaruga" : "Adopt a Turtle",
      description: loc === "it"
        ? "Con l'adozione simbolica sostieni il Centro Recupero Tartarughe Marine e ricevi il certificato di adozione."
        : "With symbolic adoption you support the Marine Turtle Recovery Center and receive an adoption certificate.",
      href: "https://www.wwf.it/cosa-puoi-fare-tu/adozioni/",
      cta: loc === "it" ? "Adotta ora" : "Adopt now",
      external: true
    }
  ];

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="mb-6">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-16 leading-relaxed">{t("intro")}</p>

      <div className="grid sm:grid-cols-2 gap-6 mb-20">
        {ways.map((way, i) => (
          <article key={i} className="card card-feature">
            <div className="card-body">
              <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center mb-4">
                <way.icon size={24} className="text-wwf-green" />
              </div>
              <h2 className="text-xl mb-3">{way.title}</h2>
              <p className="text-ink-2 mb-5 leading-relaxed">{way.description}</p>
              {way.external ? (
                <a href={way.href} target="_blank" rel="noopener noreferrer" className="cta-text">
                  {way.cta} <ArrowRight size={16} />
                </a>
              ) : (
                <Link href={way.href} className="cta-text">
                  {way.cta} <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <section id="donate" className="section-sand -mx-6 px-6 py-16 lg:-mx-10 lg:px-10 mb-20 rounded-2xl scroll-mt-20">
        <h2 className="mb-4">
          {loc === "it" ? "Bonifico Bancario" : "Bank Transfer"}
        </h2>
        <p className="text-ink-2 mb-8 max-w-3xl text-lg leading-relaxed">
          {loc === "it"
            ? "Puoi sostenere le attività del WWF Crotone con un bonifico bancario. Ogni contributo, grande o piccolo, fa la differenza per la tutela delle tartarughe marine e dell'ambiente calabrese."
            : "You can support WWF Crotone's activities with a bank transfer. Every contribution, big or small, makes a difference for the protection of sea turtles and the Calabrian environment."}
        </p>
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-grey mb-2">IBAN</p>
            <p className="font-mono text-xl break-all">{SITE.iban}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-grey mb-2">
              {loc === "it" ? "Intestato a" : "Account holder"}
            </p>
            <p className="text-xl">WWF Crotone</p>
          </div>
        </div>
        <p className="text-sm text-ink-grey mt-6">
          {loc === "it"
            ? "Causale: \"Donazione WWF Crotone\""
            : "Reference: \"Donazione WWF Crotone\""}
        </p>
      </section>

      <section className="text-center">
        <h2 className="mb-4">
          {loc === "it" ? "Grazie per il tuo supporto!" : "Thank you for your support!"}
        </h2>
        <p className="text-ink-2 mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
          {loc === "it"
            ? "Ogni gesto conta. Insieme possiamo proteggere la biodiversità della Calabria e garantire un futuro alle tartarughe marine."
            : "Every gesture counts. Together we can protect Calabria's biodiversity and ensure a future for sea turtles."}
        </p>
        <Link href={`/${loc}/contact`} className="btn btn-outline">
          {loc === "it" ? "Contattaci" : "Contact us"} <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
