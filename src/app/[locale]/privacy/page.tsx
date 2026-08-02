import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const cookie = await getTranslations("Cookie");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const sections = (await t.raw("sections")) as { h: string; p: string }[];
  const necessaryTable = (await cookie.raw("necessaryTable")) as { name: string; type: string; duration: string; purpose: string }[];
  const analyticsTable = (await cookie.raw("analyticsTable")) as { name: string; type: string; duration: string; purpose: string }[];
  const thirdPartyTable = (await cookie.raw("thirdPartyTable")) as { name: string; type: string; duration: string; purpose: string }[];

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="mb-4">{t("title")}</h1>
      <p className="text-sm text-ink-grey mb-12">{t("updated")}</p>
      <p className="text-lg text-ink-2 max-w-3xl mb-16 leading-relaxed">{t("intro")}</p>

      {/* Table of contents */}
      <nav className="mb-16 p-6 bg-sand rounded-xl border border-ink-grey-light/50" aria-label={t("toc")}>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-grey mb-4">{t("toc")}</h2>
        <ol className="space-y-2 text-sm">
          {sections.map((s, i) => (
            <li key={i}>
              <a href={`#section-${i + 1}`} className="text-ink-2 hover:text-wwf-green transition-colors">
                {s.h}
              </a>
            </li>
          ))}
          <li>
            <a href="#cookie-policy" className="text-ink-2 hover:text-wwf-green transition-colors">
              {cookie("title")}
            </a>
          </li>
        </ol>
      </nav>

      {/* Privacy sections */}
      <div className="max-w-3xl space-y-12 mb-20">
        {sections.map((s, i) => (
          <section key={i} id={`section-${i + 1}`} className="scroll-mt-24">
            <h2 className="text-xl mb-4">{s.h}</h2>
            {s.p.split("\n\n").map((paragraph, j) => (
              <p key={j} className="text-ink-2 leading-relaxed mb-3">{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      {/* Cookie Policy */}
      <div id="cookie-policy" className="border-t border-ink-grey-light pt-16 scroll-mt-24">
        <h2 className="mb-4">{cookie("title")}</h2>
        <p className="text-lg text-ink-2 max-w-3xl mb-10 leading-relaxed">{cookie("intro")}</p>

        <div className="max-w-3xl space-y-12">
          <section>
            <h3 className="text-lg mb-3">{cookie("whatAre")}</h3>
            <p className="text-ink-2 leading-relaxed">{cookie("whatAreBody")}</p>
          </section>

          <section>
            <h3 className="text-lg mb-3">{cookie("cookieList")}</h3>

            <h4 className="text-base font-semibold text-wwf-green mb-3 mt-8">{cookie("necessary")}</h4>
            <p className="text-ink-2 leading-relaxed mb-4">{cookie("necessaryBody")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-ink-grey-light/50 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-sand">
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Nome" : "Name"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Tipo" : "Type"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Durata" : "Duration"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Finalità" : "Purpose"}</th>
                  </tr>
                </thead>
                <tbody>
                  {necessaryTable.map((row, i) => (
                    <tr key={i} className="border-t border-ink-grey-light/30">
                      <td className="p-3 font-mono text-xs">{row.name}</td>
                      <td className="p-3 text-ink-2">{row.type}</td>
                      <td className="p-3 text-ink-2">{row.duration}</td>
                      <td className="p-3 text-ink-2">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="text-base font-semibold text-wwf-green mb-3 mt-8">{cookie("analytics")}</h4>
            <p className="text-ink-2 leading-relaxed mb-4">{cookie("analyticsBody")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-ink-grey-light/50 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-sand">
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Servizio" : "Service"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Tipo" : "Type"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Durata" : "Duration"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Finalità" : "Purpose"}</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsTable.map((row, i) => (
                    <tr key={i} className="border-t border-ink-grey-light/30">
                      <td className="p-3 font-mono text-xs">{row.name}</td>
                      <td className="p-3 text-ink-2">{row.type}</td>
                      <td className="p-3 text-ink-2">{row.duration}</td>
                      <td className="p-3 text-ink-2">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="text-base font-semibold text-wwf-green mb-3 mt-8">{cookie("thirdParty")}</h4>
            <p className="text-ink-2 leading-relaxed mb-4">{cookie("thirdPartyBody")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-ink-grey-light/50 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-sand">
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Servizio" : "Service"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Tipo" : "Type"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Durata" : "Duration"}</th>
                    <th className="p-3 text-left font-semibold uppercase tracking-widest text-ink-grey text-xs">{loc === "it" ? "Finalità" : "Purpose"}</th>
                  </tr>
                </thead>
                <tbody>
                  {thirdPartyTable.map((row, i) => (
                    <tr key={i} className="border-t border-ink-grey-light/30">
                      <td className="p-3 font-mono text-xs">{row.name}</td>
                      <td className="p-3 text-ink-2">{row.type}</td>
                      <td className="p-3 text-ink-2">{row.duration}</td>
                      <td className="p-3 text-ink-2">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-lg mb-3">{cookie("manage")}</h3>
            {cookie("manageBody").split("\n\n").map((paragraph: string, j: number) => (
              <p key={j} className="text-ink-2 leading-relaxed mb-3">{paragraph}</p>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
