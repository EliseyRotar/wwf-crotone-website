import Link from "next/link";
import { headers } from "next/headers";
import { ErrorPage } from "@/components/ui/ErrorPage";

/**
 * Top-level 404. Next.js calls this when no route matches.
 * The [locale]/not-found.tsx handles the locale-specific UI inside the
 * locale layout; this one is the fallback for paths that don't even
 * match /[locale]/* (e.g. /random-garbage).
 */
export default async function GlobalNotFound() {
  // Read locale from NEXT_LOCALE cookie or Accept-Language header.
  const headerStore = await headers();
  const cookieLocale = (await headerStore.get("cookie")) ?? "";
  const cookieMatch = cookieLocale.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const cookieLocale2 = cookieMatch?.[1];
  const acceptLang = headerStore.get("accept-language") ?? "";
  const acceptMatch = acceptLang.match(/^[a-z]+/);
  const detected = (cookieLocale2 || acceptMatch?.[0] || "it").toLowerCase().startsWith("en")
    ? "en"
    : "it";
  const locale = (detected === "en" ? "en" : "it") as "it" | "en";

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>404 · WWF Crotone</title>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
          background: "#fffaf2",
          color: "#101010"
        }}
      >
        <ErrorPage variant="not-found" locale={locale} homeHref={`/${locale}`} />
        <p style={{ textAlign: "center", paddingBottom: "4rem", marginTop: "-2rem" }}>
          <Link href={`/${locale}`} style={{ color: "#707070", fontSize: "0.875rem" }}>
            WWF Crotone
          </Link>
        </p>
      </body>
    </html>
  );
}
