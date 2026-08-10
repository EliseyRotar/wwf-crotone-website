const withNextIntl = require("next-intl/plugin")("./src/i18n/config.ts");
const { withSentryConfig } = require("@sentry/nextjs");

const SENTRY_ORG = process.env.SENTRY_ORG || "wwf-provincia-di-crotone-ets";
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || "javascript-nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "www.riservanaturaledelvergari.it" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "*.cdninstagram.com" }
    ]
  },
  async headers() {
    // H-06: Content-Security-Policy is now set per-request in src/middleware.ts
    // because it needs a per-request nonce to drop 'unsafe-inline'. The
    // other security headers stay here for non-matched routes (static
    // assets, .well-known, etc.) where the middleware doesn't run.
    return [
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/logos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload"
          }
        ]
      }
    ];
  }
};

// withSentryConfig is the LAST wrapper so source-map upload + the
// Sentry middleware run after everything else. `silent: !process.env.CI`
// keeps dev/local builds quiet; CI builds print upload progress.
//
// `widenClientFileUpload: true` is the recommended setting for
// readable stack traces in the browser. `authToken` is read from
// SENTRY_AUTH_TOKEN — only set in CI / on the deploy machine, never
// committed.
//
// When SENTRY_DSN is unset (typical for dev), the SDK is a no-op so
// the wrapper costs essentially nothing.
module.exports = withSentryConfig(
  withNextIntl(nextConfig),
  {
    org: SENTRY_ORG,
    project: SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Don't auto-upload a release unless SENTRY_RELEASE is set, so
    // local builds don't ship artifacts to Sentry.
    uploadSourceMaps: !!process.env.SENTRY_AUTH_TOKEN,
  }
);
