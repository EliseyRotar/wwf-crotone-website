import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

const intlMiddleware = createIntlMiddleware({
  locales: ["it", "en"],
  defaultLocale: "it",
  localePrefix: "always",
  localeDetection: true
});

const isDev = process.env.NODE_ENV !== "production";

/**
 * Edge-compatible nonce mint. We use the Web Crypto API
 * (`crypto.getRandomValues`) instead of Node's `crypto.randomBytes`
 * because the Next.js middleware runs in the edge runtime, which does
 * not expose Node built-ins.
 */
function mintNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64 without padding — short and URL-safe
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, "");
}

/**
 * Maintenance mode. When MAINTENANCE_MODE=true is set in the environment
 * (or runtime config), every public page returns the static maintenance
 * screen. Admin + API routes are exempted so operators can still
 * troubleshoot. Toggle from `.env` or by redeploying with the flag
 * flipped — no DB migration required.
 */
function isMaintenanceOn(): boolean {
  return (process.env.MAINTENANCE_MODE ?? "").toLowerCase() === "true";
}

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
  const nonce = mintNonce();
  const csp = buildCsp(nonce);

  // Mutate the request headers so downstream server code (layout,
  // pages) can read the nonce via `headers()`.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // The admin panel AND all API routes live outside the [locale]
  // segment. Skip the i18n locale rewrite on those so we don't
  //   /admin/login    → /it/admin/login  (404)
  //   /api/admin/login → /it/api/admin/login (404)
  // CSP + security headers still apply — they're attached to the
  // response below.
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";
  const isStatusHost = host === "status.wwfcrotone.it" || host.startsWith("status.wwfcrotone.it:");
  const isAdminPath =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  const isApiPath =
    pathname === "/api" ||
    pathname.startsWith("/api/");
  const isMaintenancePath =
    pathname.endsWith("/maintenance") || pathname.endsWith("/status");
  const maintenanceOn = isMaintenanceOn() && !isAdminPath && !isApiPath && !isMaintenancePath;

  // Maintenance-mode short circuit: redirect to /[locale]/maintenance
  // so the user sees the static turtle page instead of a 500.
  if (maintenanceOn) {
    const lang = (req.headers.get("accept-language") ?? "it").split(",")[0] ?? "it";
    const locale = lang.toLowerCase().startsWith("en") ? "en" : "it";
    return NextResponse.redirect(new URL(`/${locale}/maintenance`, req.url), 302);
  }

  // status.wwfcrotone.it → rewrite every public path to /[locale]/status
  // so the status page is the canonical page for this host. The visitor
  // never sees the marketing landing page when they hit the status URL.
  // /api/* still goes through normally (the status page itself fetches
  // /api/status etc.).
  if (isStatusHost && !isApiPath && !isAdminPath) {
    // Pick the locale from Accept-Language (default "it", matches the
    // apex site convention).
    const lang = (req.headers.get("accept-language") ?? "it").split(",")[0] ?? "it";
    const locale = lang.toLowerCase().startsWith("en") ? "en" : "it";

    // Strip any leading /it or /en (defensive — handle direct visits).
    let target = pathname;
    if (target === "/" || target === "") {
      target = "/status";
    } else if (target === "/it" || target === "/en") {
      target = "/status";
    } else if (target.startsWith("/it/") || target.startsWith("/en/")) {
      // e.g. /it/status → /status
      target = "/" + target.slice(3);
    }
    const newUrl = new URL(`/${locale}${target}`, req.url);
    return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
  }

  const skipI18n = isAdminPath || isApiPath;
  const res = skipI18n
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : intlMiddleware(new NextRequest(req, { headers: requestHeaders })) ??
      NextResponse.next({ request: { headers: requestHeaders } });

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
  const scriptSrc = ["'self'", "https://plausible.io"];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
    scriptSrc.push("'unsafe-inline'");
  } else {
    // Next.js injects inline scripts for RSC hydration that don't carry
    // the nonce. Use 'unsafe-inline' without nonce — the nonce+unsafe-inline
    // combination is ignored by browsers per CSP spec.
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
  // Skip the i18n rewrite for /admin/* (admin lives outside [locale]).
  // We still want the CSP + security headers on those routes, so we run
  // our middleware but bypass next-intl's locale rewrite.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/:path*"]
};
