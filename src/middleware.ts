import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

const intlMiddleware = createIntlMiddleware({
  locales: ["it", "en"],
  defaultLocale: "it",
  localePrefix: "always",
  localeDetection: true
});

export function middleware(req: NextRequest) {
  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|admin|.*\\..*).*)"]
};