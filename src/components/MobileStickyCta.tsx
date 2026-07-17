"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";

export default function MobileStickyCta() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const [show, setShow] = useState(false);

  const isDatesPage = pathname.includes("/dates");

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const past = y > 400;
      const nearBottom = y > h - 400;
      setShow(past && !nearBottom && !isDatesPage);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDatesPage]);

  if (!show) return null;

  return (
    <Link href={`/${locale}/dates#form`} className="mobile-cta show">
      {t("bookNow")}
    </Link>
  );
}