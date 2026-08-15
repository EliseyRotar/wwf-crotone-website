import type { MetadataRoute } from "next";

/**
 * /robots.txt — crawl rules + sitemap pointer.
 *
 * Public routes are indexed. The following are NOINDEX because they are
 * either authenticated or non-canonical:
 *   - /admin/*                  (operator panel)
 *   - /api/*                    (internal JSON endpoints)
 *   - /it/account/*             (volunteer dashboard, requires magic-link)
 *   - /en/account/*             (same)
 *   - /it/mio-iscrizione/*      (legacy alias)
 *   - /en/mio-iscrizione/*      (same)
 *   - /it/maintenance           (offline splash)
 *   - /en/maintenance           (same)
 *   - /sentry-example-page      (sentry test page, do not index)
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin",
          "/api",
          "/it/account",
          "/en/account",
          "/it/mio-iscrizione",
          "/en/mio-iscrizione",
          "/it/maintenance",
          "/en/maintenance",
          "/sentry-example-page"
        ]
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}