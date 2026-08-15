import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * 404 inside the [locale] layout — renders with the full site
 * header/footer. Locale is detected by Next.js from the URL segment.
 */
export default async function NotFound() {
  // next/navigation can't read params here, but the layout already
  // set the request locale, so we read it from cookies as a fallback
  // for picking the right copy variant.
  const { cookies } = await import("next/headers");
  const c = await cookies();
  const nextLocale = c.get("NEXT_LOCALE")?.value;
  const locale: "it" | "en" = nextLocale === "en" ? "en" : "it";
  return <ErrorPage variant="not-found" locale={locale} homeHref={`/${locale}`} />;
}
