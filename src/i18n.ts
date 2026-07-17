import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

const locales = ["it", "en"] as const;
type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) notFound();
  return {
    locale: locale as Locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});