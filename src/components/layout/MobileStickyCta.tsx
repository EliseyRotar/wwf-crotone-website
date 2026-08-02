"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useScrollFlag } from "@/hooks/useScrollFlag";

const SHOW_AT = 400;
const HIDE_BEFORE_BOTTOM = 400;

export default function MobileStickyCta() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const [nearBottom, setNearBottom] = useState(false);
  const ticking = useRef(false);
  const past = useScrollFlag(SHOW_AT);

  const isDatesPage = pathname.includes("/dates");

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        setNearBottom(y > h - HIDE_BEFORE_BOTTOM);
        ticking.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!past || nearBottom || isDatesPage) return null;

  return (
    <Link href={`/${locale}/dates#form`} className="mobile-cta show">
      {t("bookNow")}
    </Link>
  );
}
