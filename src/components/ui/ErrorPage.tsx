"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Branded error page used as a fallback across the app.
 *
 * Used by:
 *  - src/app/global-error.tsx   (catastrophic — replaces <html>)
 *  - src/app/[locale]/error.tsx (Server Component error)
 *  - src/app/admin/error.tsx    (Admin error)
 *  - src/app/[locale]/not-found.tsx (404)
 *  - src/app/not-found.tsx       (top-level 404)
 *
 * The page intentionally does NOT leak the underlying error message
 * or stack trace to the public. We log it to the console for
 * debugging; in production, Sentry captures it via the existing
 * next.config.js wiring.
 *
 * Variants:
 *  - "not-found" → 404 message
 *  - "server-error" → 500 message
 *  - "global-error" → 500 + retry
 *
 * Pass `path` to make the "back home" link locale-aware.
 */
export type ErrorVariant = "not-found" | "server-error" | "global-error";

const COPY: Record<
  ErrorVariant,
  {
    it: { title: string; subtitle: string; body: string; primary: string };
    en: { title: string; subtitle: string; body: string; primary: string };
  }
> = {
  "not-found": {
    it: {
      title: "404",
      subtitle: "Pagina non trovata",
      body: "La pagina che stai cercando non esiste o è stata spostata. Forse il link è vecchio, o hai digitato male l'indirizzo.",
      primary: "Torna alla home"
    },
    en: {
      title: "404",
      subtitle: "Page not found",
      body: "The page you're looking for doesn't exist or has been moved. The link may be out of date, or you may have mistyped the URL.",
      primary: "Back to home"
    }
  },
  "server-error": {
    it: {
      title: "Qualcosa è andato storto",
      subtitle: "Errore del server",
      body: "Abbiamo riscontrato un problema temporaneo. Riprova tra qualche secondo. Se il problema persiste, scrivici e cercheremo di risolvere.",
      primary: "Riprova"
    },
    en: {
      title: "Something went wrong",
      subtitle: "Server error",
      body: "We hit a temporary problem. Please try again in a few seconds. If the issue persists, get in touch and we'll look into it.",
      primary: "Try again"
    }
  },
  "global-error": {
    it: {
      title: "Errore grave",
      subtitle: "Il sito ha riscontrato un problema critico",
      body: "Si è verificato un errore che ha impedito al sito di funzionare. Ricarica la pagina. Se continui a vedere questo messaggio, scrivici.",
      primary: "Ricarica la pagina"
    },
    en: {
      title: "Critical error",
      subtitle: "The site ran into a critical problem",
      body: "An error prevented the site from working. Please reload the page. If you keep seeing this message, get in touch.",
      primary: "Reload page"
    }
  }
};

export function ErrorPage({
  variant,
  locale,
  homeHref,
  error,
  onRetry,
  minimal = false
}: {
  variant: ErrorVariant;
  locale: "it" | "en";
  homeHref: string;
  error?: Error & { digest?: string };
  onRetry?: () => void;
  /**
   * minimal = true: render only a <body> and minimal CSS, used by
   * global-error.tsx which has to replace the entire <html>.
   */
  minimal?: boolean;
}) {
  useEffect(() => {
    if (error && variant !== "not-found") {
      // Sentry captures automatically via the runtime; we log here for
      // clarity in dev.
      // eslint-disable-next-line no-console
      console.error(`[${variant}]`, error);
    }
  }, [error, variant]);

  const t = COPY[variant][locale];

  const content = (
    <main
      role="main"
      className="min-h-[60vh] flex items-center justify-center px-4 py-16 text-center"
    >
      <div className="max-w-xl space-y-4">
        <p className="font-head text-7xl md:text-8xl text-[var(--c-wwf-green,#007932)] tracking-tight leading-none">
          {t.title}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink">{t.subtitle}</h1>
        <p className="text-base text-ink-2 leading-relaxed">{t.body}</p>
        {error?.digest && variant === "server-error" && (
          <p className="text-xs font-mono text-ink-grey/70 break-all">
            {locale === "it" ? "Codice errore: " : "Error code: "}
            {error.digest}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn btn-primary inline-flex items-center gap-1.5"
            >
              {t.primary}
            </button>
          )}
          <Link href={homeHref} className="btn btn-outline inline-flex items-center gap-1.5">
            {locale === "it" ? "Vai alla home" : "Go home"}
          </Link>
          <Link
            href={locale === "it" ? "/it/contact" : "/en/contact"}
            className="text-sm text-ink-grey hover:text-ink underline"
          >
            {locale === "it" ? "Contattaci" : "Contact us"}
          </Link>
        </div>
      </div>
    </main>
  );

  if (minimal) {
    return (
      <html lang={locale}>
        <body
          style={{
            margin: 0,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
            background: "#fffaf2",
            color: "#101010"
          }}
        >
          {content}
        </body>
      </html>
    );
  }

  return content;
}
