import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Mail, Phone, Facebook, Instagram, Plane, Train, Bus, Car } from "lucide-react";
import { SITE } from "@/lib/site";
import WeatherWidget from "@/components/WeatherWidget";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/contact` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/contact`
    }
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  const tFooter = await getTranslations("Footer");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const reach = [
    { icon: Plane, title: t("plane"), body: t("planeBody") },
    { icon: Train, title: t("train"), body: t("trainBody") },
    { icon: Bus, title: t("bus"), body: t("busBody") },
    { icon: Car, title: t("car"), body: t("carBody") }
  ];

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-3">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-6 leading-relaxed">{t("intro")}</p>
      <div className="mb-8"><WeatherWidget /></div>

      <div className="grid lg:grid-cols-2 gap-12">
        <section>
          <h2 className="text-2xl mb-6">{t("title")}</h2>
          <ul className="space-y-4 mb-8">
            <li>
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-ink-2 hover:text-wwf-green">
                <Mail size={22} className="text-wwf-green" /> {SITE.email}
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phonePaolo.replace(/\s/g, "")}`} className="flex items-center gap-3 text-ink-2 hover:text-wwf-green">
                <Phone size={22} className="text-wwf-green" /> <span><strong>{t("paoloLabel")}</strong><br />{t("phoneLabel")}: {SITE.phonePaolo}</span>
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phoneField.replace(/\s/g, "")}`} className="flex items-center gap-3 text-ink-2 hover:text-wwf-green">
                <Phone size={22} className="text-wwf-green" /> <span><strong>{t("fieldLabel")}</strong><br />{t("phoneLabel")}: {SITE.phoneField}</span>
              </a>
            </li>
          </ul>
          <h3 className="text-lg mb-3 uppercase tracking-cta text-ink-grey">{tFooter("followUs")}</h3>
          <div className="flex gap-3">
            <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn btn-outline">
              <Facebook size={18} /> {t("facebook")}
            </a>
            <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn btn-outline">
              <Instagram size={18} /> {t("instagram")}
            </a>
          </div>
        </section>

        <section>
          <div className="aspect-[4/3] w-full overflow-hidden border-2 border-ink-grey-light">
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=16.85%2C38.88%2C17.05%2C39.00&layer=mapnik&marker=38.9403%2C16.9497"
              className="w-full h-full"
              style={{ border: 0 }}
              loading="lazy"
              title="Mappa — San Leonardo di Cutro (KR), Calabria"
            />
          </div>
          <p className="text-xs text-ink-grey mt-2 text-center">
            <a
              href="https://www.openstreetmap.org/?mlat=38.9403&mlon=16.9497#map=14/38.9403/16.9497"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wwf-green underline"
            >
              San Leonardo di Cutro (KR), Calabria — apri in OpenStreetMap
            </a>
          </p>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl mb-3">{t("reachTitle")}</h2>
        <p className="text-ink-2 mb-8 max-w-3xl">{t("reachIntro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {reach.map((r, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <r.icon size={26} className="text-wwf-green mb-2" aria-hidden />
                <h3 className="text-base mb-1">{r.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="card section-sand">
          <div className="card-body">
            <h3 className="text-lg mb-1">{t("transferTitle")}</h3>
            <p className="text-ink-2 leading-relaxed">{t("transferBody")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}