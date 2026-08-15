import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Mail, Phone, MessageCircle, Facebook, Instagram, Plane, Train, Bus, Car, Building2, FileText, User, AtSign } from "lucide-react";
import { SITE } from "@/config/site";
import WeatherWidget from "@/components/features/WeatherWidget";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/contact` },
    openGraph: { title: `${t("title")} · ${SITE.legalName}`, description: t("intro"), url: `${baseUrl}/${locale}/contact` }
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

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tNav("home"), item: `${baseUrl}/${loc}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `${baseUrl}/${loc}/contact` }
    ]
  };

  return (
    <div className="container section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="mb-4">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-8 leading-relaxed">{t("intro")}</p>
      <div className="mb-12"><WeatherWidget /></div>

      <div className="grid lg:grid-cols-2 gap-16">
        <section>
          <h2 className="mb-8">{t("title")}</h2>
          <ul className="space-y-5 mb-10">
            <li>
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-4 text-ink-2 hover:text-wwf-green transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center shrink-0 group-hover:bg-wwf-green/20 transition-colors">
                  <Mail size={22} className="text-wwf-green" />
                </div>
                <span className="text-lg">{SITE.email}</span>
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phonePaolo.replace(/\s/g, "")}`} className="flex items-center gap-4 text-ink-2 hover:text-wwf-green transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center shrink-0 group-hover:bg-wwf-green/20 transition-colors">
                  <Phone size={22} className="text-wwf-green" />
                </div>
                <div>
                  <p className="font-semibold">{t("paoloLabel")}</p>
                  <p className="text-ink-grey">{SITE.phonePaolo}</p>
                </div>
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phoneField.replace(/\s/g, "")}`} className="flex items-center gap-4 text-ink-2 hover:text-wwf-green transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center shrink-0 group-hover:bg-wwf-green/20 transition-colors">
                  <Phone size={22} className="text-wwf-green" />
                </div>
                <div>
                  <p className="font-semibold">{t("fieldLabel")}</p>
                  <p className="text-ink-grey">{SITE.phoneField}</p>
                </div>
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${SITE.phoneField.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 text-ink-2 hover:text-wwf-green transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-wwf-green/10 flex items-center justify-center shrink-0 group-hover:bg-wwf-green/20 transition-colors">
                  <MessageCircle size={22} className="text-wwf-green" />
                </div>
                <div>
                  <p className="font-semibold">{loc === "it" ? "WhatsApp" : "WhatsApp"}</p>
                  <p className="text-ink-grey">{loc === "it" ? "Scrivici su WhatsApp" : "Message us on WhatsApp"}</p>
                </div>
              </a>
            </li>
          </ul>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-ink-grey mb-4">{tFooter("followUs")}</h3>
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
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-ink-grey-light shadow-lg">
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=16.85%2C38.88%2C17.05%2C39.00&layer=voyager&marker=38.9403%2C16.9497"
              className="w-full h-full"
              style={{ border: 0 }}
              loading="lazy"
              title={loc === "it" ? "Mappa — San Leonardo di Cutro (KR), Calabria" : "Map — San Leonardo di Cutro (KR), Calabria"}
            />
          </div>
          <p className="text-xs text-ink-grey mt-3 text-center">
            <a
              href="https://www.openstreetmap.org/?mlat=38.9403&mlon=16.9497#map=14/38.9403/16.9497"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wwf-green underline"
            >
              San Leonardo di Cutro (KR), Calabria — {loc === "it" ? "apri in OpenStreetMap" : "open in OpenStreetMap"}
            </a>
          </p>
          {/* Google Maps link for users who prefer to navigate there */}
          <p className="text-xs text-ink-grey/70 mt-1 text-center">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=WWF+Crotone+San+Leonardo+di+Cutro+KR`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wwf-green underline"
            >
              {loc === "it" ? "Apri anche in Google Maps →" : "Also open in Google Maps →"}
            </a>
          </p>
        </section>
      </div>

      <section className="mt-20 card section-sand border-l-4 border-l-wwf-green">
        <div className="card-body">
          <h2 className="text-xl mb-4">{loc === "it" ? "Sede legale e dati associativi" : "Registered office & association data"}</h2>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-ink-grey">{loc === "it" ? "Ragione sociale" : "Legal name"}</dt>
              <dd className="font-semibold">WWF PROVINCIA DI CROTONE-ETS</dd>
            </div>
            <div>
              <dt className="text-ink-grey">{loc === "it" ? "Forma giuridica" : "Legal form"}</dt>
              <dd>Organizzazione di Volontariato (ODV) — D.Lgs. 117/2017</dd>
            </div>
            <div>
              <dt className="text-ink-grey">{loc === "it" ? "Codice Fiscale" : "Tax ID"}</dt>
              <dd className="font-mono">91034580794</dd>
            </div>
            <div>
              <dt className="text-ink-grey">{loc === "it" ? "Presidente" : "President"}</dt>
              <dd>Paolo Asteriti</dd>
            </div>
            <div>
              <dt className="text-ink-grey">{loc === "it" ? "Sede legale" : "Registered office"}</dt>
              <dd>Località Marinella San Leonardo di Cutro, 88842 Cutro (KR)</dd>
            </div>
            <div>
              <dt className="text-ink-grey">PEC</dt>
              <dd><a href="mailto:wwfcrotone@legalmail.it" className="hover:text-wwf-green underline">wwfcrotone@legalmail.it</a></dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="mb-4">{t("reachTitle")}</h2>
        <p className="text-ink-2 mb-10 max-w-3xl text-lg leading-relaxed">{t("reachIntro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {reach.map((r, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center mb-3">
                  <r.icon size={20} className="text-wwf-green" aria-hidden />
                </div>
                <h3 className="text-base mb-2">{r.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="card section-sand border-l-4 border-l-wwf-green">
          <div className="card-body">
            <h3 className="text-lg mb-2">{t("transferTitle")}</h3>
            <p className="text-ink-2 leading-relaxed">{t("transferBody")}</p>
          </div>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="sede-legale">
        <h2 id="sede-legale" className="mb-2">{t("legalTitle")}</h2>
        <p className="text-ink-2 mb-8 max-w-3xl text-lg leading-relaxed">
          {loc === "it"
            ? "Informazioni legali e sede dell'associazione, come da Statuto e Atto Costitutivo."
            : "Legal details and registered office of the association, as per Articles of Association."}
        </p>
        <div className="card">
          <div className="card-body">
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 size={18} className="text-wwf-green" aria-hidden />
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-ink-grey">{t("legalRagione")}</dt>
                  <dd className="text-base font-semibold mt-0.5">{t("legalRagioneValue")}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={18} className="text-wwf-green" aria-hidden />
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-ink-grey">{t("legalForma")}</dt>
                  <dd className="text-base mt-0.5">{t("legalFormaValue")}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={18} className="text-wwf-green" aria-hidden />
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-ink-grey">{t("legalCf")}</dt>
                  <dd className="text-base font-mono mt-0.5">{t("legalCfValue")}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={18} className="text-wwf-green" aria-hidden />
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-ink-grey">{t("legalPresidente")}</dt>
                  <dd className="text-base mt-0.5">{t("legalPresidenteValue")}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 size={18} className="text-wwf-green" aria-hidden />
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-ink-grey">{t("legalSede")}</dt>
                  <dd className="text-base mt-0.5">{t("legalSedeValue")}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="w-10 h-10 rounded-lg bg-wwf-green/10 flex items-center justify-center shrink-0 mt-0.5">
                  <AtSign size={18} className="text-wwf-green" aria-hidden />
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-ink-grey">
                    {t("legalPec")} <span className="font-normal normal-case text-ink-grey/80">— {t("legalPecLabel")}</span>
                  </dt>
                  <dd>
                    <a href={`mailto:${SITE.pec}`} className="text-base mt-0.5 text-ink-2 hover:text-wwf-green transition-colors break-all">
                      {t("legalPecValue")}
                    </a>
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
