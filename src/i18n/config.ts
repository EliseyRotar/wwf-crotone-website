import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

const locales = ["it", "en"] as const;
type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (locale && locales.includes(locale as Locale)) {
    return {
      locale: locale as Locale,
      messages: (await import(`./messages/${locale}.json`)).default
    };
  }

  // No locale segment in URL — this is an admin route (or another non-public
  // route excluded from the locale middleware). Fall back to "it".
  if (!locale) {
    return {
      locale: "it" as Locale,
      messages: (await import(`./messages/it.json`)).default
    };
  }

  // The URL has a locale segment but it's not one we support (e.g. /xx/...).
  // Detect admin routes via the request path; admin routes never reach here
  // because the middleware excludes them, but we still guard against
  // direct navigation. For any other invalid public locale, 404.
  let pathname = "";
  try {
    const h = await headers();
    pathname = h.get("x-invoke-path") ?? h.get("x-pathname") ?? h.get("next-url") ?? "";
  } catch {
    pathname = "";
  }
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api");
  if (isAdmin) {
    return {
      locale: "it" as Locale,
      messages: (await import(`./messages/it.json`)).default
    };
  }

  notFound();
});
