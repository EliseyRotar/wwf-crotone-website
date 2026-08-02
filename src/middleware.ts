import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { randomBytes } from "crypto";

const intlMiddleware = createIntlMiddleware({
  locales: ["it", "en"],
  defaultLocale: "it",
  localePrefix: "always",
  localeDetection: true
});

const isDev = process.env.NODE_ENV !== "production";

/**
 * H-06: build a per-request CSP with a per-request nonce. We removed the
 * static 'unsafe-inline' from script-src — the only safe exception in
 * production. In dev we still allow 'unsafe-eval' (Next.js HMR uses it)
 * and also keep 'unsafe-inline' because Next.js dev hydration bits
 * occasionally rely on inline scripts; this matches Next's own docs.
 *
 * Mechanics:
 *  - Mint a nonce per request.
 *  - Forward it on the request headers (so server components can read
 *    it via `headers().get("x-nonce")`) AND attach it to the response
 *    so the browser enforces it. We use NextResponse.next() with
 *    `request: { headers }` to mutate the incoming request.
 *  - The same nonce appears in the CSP we set on the response.
 *
 * Server components that emit inline <script> tags (e.g. the [locale]
 * layout's theme init + JSON-LD) must attach `nonce={nonce}` for the
 * browser to allow them.
 */
export function middleware(req: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const csp = buildCsp(nonce);

  // Mutate the request headers so downstream server code (layout,
  // pages) can read the nonce via `headers()`.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // Let the i18n middleware do its locale rewrite using the modified
  // request, then we layer our CSP on top.
  const res = intlMiddleware(
    new NextRequest(req, { headers: requestHeaders })
  ) ?? NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("x-nonce", nonce);
  res.headers.set("Content-Security-Policy", csp);

  // Hardening headers mirrored from next.config.js so dev-mode reloads
  // don't have to wait for a fresh `next build` to apply them.
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");

  return res;
}

function buildCsp(nonce: string): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "https://plausible.io"];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
    scriptSrc.push("'unsafe-inline'");
  }
  const connectSrc = [
    "'self'",
    "https://plausible.io",
    "https://api.open-meteo.com",
    "https://api.groq.com",
    "https://*.tile.openstreetmap.org",
    "https://*.basemaps.cartocdn.com",
    "ws:",
    "wss:"
  ];
  return [
    "default-src 'self'",
    "img-src 'self' data: https://images.unsplash.com https://www.riservanaturaledelvergari.it https://i.ytimg.com https://*.cdninstagram.com https://scontent.cdninstagram.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    "media-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://www.openstreetmap.org",
    `script-src ${scriptSrc.join(" ")}`,
    // Style still needs 'unsafe-inline' in many real-world apps —
    // Next.js' RSC payload uses inline style attributes. Removing this
    // entirely would break styling.
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join("; ");
}

export const config = {
  // Run the middleware on every route (including /api) so the nonce is
  // available everywhere it is needed and CSP is enforced uniformly.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/:path*"]
};
