import { setRequestLocale } from "next-intl/server";

/**
 * Static maintenance page shown during deploy cutovers and emergency
 * maintenance. Toggled via the MAINTENANCE_MODE env var in src/middleware.ts.
 * The page renders without any DB calls so it stays up even if the app
 * container is restarting.
 */
export const dynamic = "force-static";

export default async function MaintenancePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isIt = locale === "it";

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="robots" content="noindex" />
        <title>{isIt ? "Manutenzione in corso" : "Maintenance in progress"} — WWF Crotone</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#007932",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.5rem"
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }} aria-hidden>
            🐢
          </div>
          <h1 style={{ fontSize: "2rem", margin: "0 0 1rem", fontWeight: 700 }}>
            {isIt ? "Stiamo lavorando per voi" : "We're working on it"}
          </h1>
          <p style={{ fontSize: "1.125rem", lineHeight: 1.6, margin: "0 0 2rem", opacity: 0.95 }}>
            {isIt
              ? "Il sito è temporaneamente in manutenzione per migliorare il servizio. Torneremo online a brevissimo."
              : "The site is temporarily down for maintenance. We'll be back online shortly."}
          </p>
          <a
            href={`/${locale}/status`}
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "#fff",
              color: "#007932",
              textDecoration: "none",
              borderRadius: "999px",
              fontWeight: 600
            }}
          >
            {isIt ? "Stato del servizio" : "Service status"}
          </a>
        </div>
      </body>
    </html>
  );
}