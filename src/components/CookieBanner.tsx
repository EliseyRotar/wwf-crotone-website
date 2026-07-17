"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function CookieBanner() {
  const t = useTranslations("Cookie");
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
    <div className="cookie-banner" role="dialog" aria-label="Cookie">
      <div className="container flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
        <p className="text-sm text-white/85 md:max-w-3xl">{t("bannerText")}</p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={essential} className="btn btn-outline text-white border-white">
            {t("settings")}
          </button>
          <button onClick={accept} className="btn btn-primary">
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}