"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function CookieBanner() {
  const t = useTranslations("Cookie");
  const locale = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "all");
    setShow(false);
  };

  const essential = () => {
    localStorage.setItem("cookie-consent", "essential");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label={t("bannerTitle")}>
      <div className="container flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
        <p className="text-sm text-white/85 md:max-w-3xl">
          {t("bannerText")}{" "}
          <Link href={`/${locale}/privacy#cookie-policy`} className="underline hover:text-wwf-orange transition-colors">
            {t("bannerLink")}
          </Link>.
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={essential} className="btn btn-outline text-white border-white/60 hover:bg-white hover:text-ink">
            {t("essentialOnly")}
          </button>
          <button onClick={accept} className="btn btn-primary">
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
