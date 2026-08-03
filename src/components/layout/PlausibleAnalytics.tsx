import Script from "next/script";

/**
 * Plausible Analytics — privacy-first, cookie-free, no consent banner
 * required under GDPR (the Italian Garante confirms this for non-profiling
 * analytics). Disabled unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set in
 * `.env`. Script is loaded via next/script with the per-request CSP nonce
 * stamped automatically by middleware (see src/middleware.ts).
 */
export default function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <>
      <link rel="preconnect" href="https://plausible.io" />
      <link rel="dns-prefetch" href="https://plausible.io" />
      <Script
        defer
        data-domain={domain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    </>
  );
}