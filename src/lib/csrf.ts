const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  // Also allow www subdomain (Cloudflare redirects apex → www for some visitors)
  process.env.NEXT_PUBLIC_SITE_URL ? process.env.NEXT_PUBLIC_SITE_URL.replace("://", "://www.") : null,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

export function validateOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    return ALLOWED_ORIGINS.includes(origin);
  }
  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    const refererUrl = new URL(referer);
    return ALLOWED_ORIGINS.includes(refererUrl.origin);
  } catch {
    return false;
  }
}

// TODO H-10: Add Cloudflare Turnstile verification.
//
// Origin-based CSRF protection (what `validateOrigin` does) catches the
// simple cross-site cases but does nothing about credential-stuffing
// bots that target our own origin. The plan:
//
//   1. Add a Turnstile widget to /dates and /mio-iscrizione (the two
//      forms exposed to anonymous traffic).
//   2. Verify the resulting token server-side via
//      https://challenges.cloudflare.com/turnstile/v0/siteverify against
//      TURNSTILE_SECRET.
//   3. Wire it into a new src/lib/captcha.ts helper called from the POST
//      handlers in src/app/api/iscrizione/route.ts and
//      src/app/api/newsletter/route.ts.
//
// Skipped in this pass to keep the launch on schedule.
