import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const tNav = await getTranslations("Nav");
  const cookie = await getTranslations("Cookie");
  const loc = locale;

  const sections = (await t.raw("sections")) as { h: string; p: string }[];

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <a href={`/${loc}`}>{tNav("home")}</a>
        <li aria-current="page">{t("title")}</li>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-3">{t("title")}</h1>
      <p className="text-sm text-ink-grey mb-10">{t("updated")}</p>
      <p className="text-lg text-ink-2 max-w-3xl mb-12 leading-relaxed">{t("intro")}</p>

      <div className="max-w-3xl space-y-8 mb-16">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-xl md:text-2xl mb-3">{s.h}</h2>
            <p className="text-ink-2 leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>

      <div className="border-t border-ink-grey-light pt-12">
        <h2 className="text-3xl md:text-4xl mb-3">{cookie("title")}</h2>
        <p className="text-lg text-ink-2 max-w-3xl mb-8 leading-relaxed">{cookie("intro")}</p>
        <div className="space-y-6 max-w-3xl">
          <section>
            <h3 className="text-lg mb-2">{cookie("necessary")}</h3>
            <p className="text-ink-2">{cookie("necessaryBody")}</p>
          </section>
          <section>
            <h3 className="text-lg mb-2">{cookie("analytics")}</h3>
            <p className="text-ink-2">{cookie("analyticsBody")}</p>
          </section>
          <section>
            <h3 className="text-lg mb-2">{cookie("thirdParty")}</h3>
            <p className="text-ink-2">{cookie("thirdPartyBody")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}