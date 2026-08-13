import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { createHash } from "node:crypto";

type Outcome =
  | { kind: "ready"; firstName: string; iscrizioneId: string; token: string }
  | { kind: "already-verified"; firstName: string; iscrizioneId: string; token: string }
  | { kind: "invalid-token" }
  | { kind: "expired" }
  | { kind: "server-error"; message: string };

/**
 * /[locale]/account/verify?token=...&locale=...
 *
 * Lands here when a volunteer clicks the verify-email link from their
 * registration confirmation mail. We render an interstitial card that
 * confirms the email — but we DO NOT consume the token here, because
 * Server Components in Next.js 15 can't write cookies, and we need
 * to set the session cookie so the "Carica la ricevuta" CTA lands
 * the user on the receipts page logged in.
 *
 * The actual consume + cookie + 302-redirect lives in the companion
 * Route Handler at /api/account/verify-email. The CTA button links
 * to that endpoint; clicking it does the verify + login + redirect
 * in a single round-trip.
 *
 * If the user reads the success message and walks away without
 * clicking the CTA, that's fine — the token expires 24h after it was
 * issued.
 */
export default async function VerifyEmailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; locale?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Account.verifyEmail" });

  const token = sp.token?.trim();
  if (!token) {
    return <VerifyLayout outcome={{ kind: "invalid-token" }} t={t} locale={locale} />;
  }

  // Hash the raw token the same way createVerificationTokenForIscrizione
  // does, then look up by the unique tokenHash column.
  const tokenHash = createHash("sha256").update(token).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const candidate = await prisma.iscrizioneVerificationToken.findUnique({
    where: { tokenHash },
    include: {
      iscrizione: { select: { id: true, status: true, firstName: true, email: true } }
    }
  });

  if (!candidate) {
    return <VerifyLayout outcome={{ kind: "invalid-token" }} t={t} locale={locale} />;
  }
  if (candidate.expiresAt.getTime() < Date.now()) {
    return <VerifyLayout outcome={{ kind: "expired" }} t={t} locale={locale} />;
  }

  // Already verified → still show the success page (idempotent), with a
  // CTA that goes through the API route to log the user in.
  if (
    candidate.iscrizione.status === "email_verified" ||
    candidate.iscrizione.status === "receipt_uploaded" ||
    candidate.iscrizione.status === "confirmed" ||
    candidate.iscrizione.status === "paid"
  ) {
    return (
      <VerifyLayout
        outcome={{
          kind: "already-verified",
          firstName: candidate.iscrizione.firstName,
          iscrizioneId: candidate.iscrizione.id,
          token
        }}
        t={t}
        locale={locale}
      />
    );
  }

  // Token is still valid, iscrizione is still pending. Render the
  // interstitial; the CTA will trigger the actual consume + cookie
  // + redirect via the API route.
  return (
    <VerifyLayout
      outcome={{
        kind: "ready",
        firstName: candidate.iscrizione.firstName,
        iscrizioneId: candidate.iscrizione.id,
        token
      }}
      t={t}
      locale={locale}
    />
  );
}

function VerifyLayout({
  outcome,
  t,
  locale
}: {
  outcome: Outcome;
  t: Awaited<ReturnType<typeof getTranslations>>;
  locale: string;
}) {
  const path = (p: string) => `/${locale}/${p}`;
  const card = (children: React.ReactNode, tone: "ok" | "warn") => (
    <main id="main" className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="card max-w-xl w-full p-8 sm:p-10">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-5 ${
          tone === "ok" ? "bg-wwf-green-pale/60 text-wwf-green-dark" : "bg-wwf-orange/20 text-wwf-orange"
        }`}>
          {tone === "ok" ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
        </div>
        {children}
      </div>
    </main>
  );

  // Build the API URL for the CTA. Same endpoint does consume + cookie +
  // 302-redirect, so the click lands the user logged-in on the receipts
  // page.
  const apiHref = (tok: string) =>
    `/api/account/verify-email?token=${encodeURIComponent(tok)}&locale=${locale}`;

  switch (outcome.kind) {
    case "ready":
      return card(
        <>
          <h1 className="text-2xl sm:text-3xl mb-2">{t("successTitle")}</h1>
          <p className="text-ink-2 mb-6">
            {t("successBody", { name: outcome.firstName })}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={apiHref(outcome.token)}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              {t("uploadReceiptCta")}
              <ArrowRight size={16} />
            </Link>
            <Link
              href={path("")}
              className="btn btn-outline flex items-center justify-center"
            >
              {t("backHome")}
            </Link>
          </div>
        </>,
        "ok"
      );
    case "already-verified":
      return card(
        <>
          <h1 className="text-2xl sm:text-3xl mb-2">{t("alreadyTitle")}</h1>
          <p className="text-ink-2 mb-6">
            {t("alreadyBody", { name: outcome.firstName })}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* API route sets the cookie + redirects to /account */}
            <Link href={apiHref(outcome.token)} className="btn btn-primary">
              {t("goToPanel")}
            </Link>
          </div>
        </>,
        "ok"
      );
    case "invalid-token":
      return card(
        <>
          <h1 className="text-2xl sm:text-3xl mb-2">{t("invalidTitle")}</h1>
          <p className="text-ink-2 mb-6">{t("invalidBody")}</p>
          <Link href={path("account/login")} className="btn btn-primary">
            {t("goToPanel")}
          </Link>
        </>,
        "warn"
      );
    case "expired":
      return card(
        <>
          <h1 className="text-2xl sm:text-3xl mb-2">{t("expiredTitle")}</h1>
          <p className="text-ink-2 mb-6">{t("expiredBody")}</p>
          <Link href={path("account/login")} className="btn btn-primary">
            {t("goToPanel")}
          </Link>
        </>,
        "warn"
      );
    case "server-error":
      return card(
        <>
          <h1 className="text-2xl sm:text-3xl mb-2">{t("errorTitle")}</h1>
          <p className="text-ink-2 mb-6">{t("errorBody")}</p>
          <Link href={path("")} className="btn btn-outline">
            {t("backHome")}
          </Link>
        </>,
        "warn"
      );
  }
}
