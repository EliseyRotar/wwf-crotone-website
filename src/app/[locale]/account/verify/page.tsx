import { consumeVerificationToken, advanceStatus } from "@/lib/userFlow";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

type Outcome =
  | { kind: "ok"; firstName: string; iscrizioneId: string }
  | { kind: "already-verified"; firstName: string }
  | { kind: "invalid-token" }
  | { kind: "expired" }
  | { kind: "server-error"; message: string };

/**
 * /[locale]/account/verify?token=...&locale=...
 *
 * Lands here when a volunteer clicks the verify-email link from their
 * registration confirmation mail. We redeem the token server-side,
 * advance the Iscrizione lifecycle from "pending" → "email_verified",
 * and render a confirmation card with a CTA to upload the receipt.
 *
 * We deliberately do this in a Server Component (no client-side JS) —
 * the user just opened an email link, no SPA needed.
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
  const crypto = await import("node:crypto");
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

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

  // If already past email_verified, just confirm idempotently.
  if (
    candidate.iscrizione.status === "email_verified" ||
    candidate.iscrizione.status === "receipt_uploaded" ||
    candidate.iscrizione.status === "confirmed" ||
    candidate.iscrizione.status === "paid"
  ) {
    return (
      <VerifyLayout
        outcome={{ kind: "already-verified", firstName: candidate.iscrizione.firstName }}
        t={t}
        locale={locale}
      />
    );
  }

  let outcome: Outcome;
  try {
    const iscrizioneId = await consumeVerificationToken(token, "email_verified");
    if (!iscrizioneId || iscrizioneId !== candidate.iscrizione.id) {
      outcome = { kind: "invalid-token" };
    } else {
      const updated = await advanceStatus(candidate.iscrizione.id, "email_verified", {
        skipNotification: false
      });
      if (!updated) {
        outcome = { kind: "server-error", message: "advanceStatus failed" };
      } else {
        outcome = {
          kind: "ok",
          firstName: updated.firstName,
          iscrizioneId: updated.id
        };
      }
    }
  } catch (err) {
    console.error("[verify] redeem failed:", err);
    outcome = { kind: "server-error", message: String(err) };
  }

  return <VerifyLayout outcome={outcome} t={t} locale={locale} />;
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

  switch (outcome.kind) {
    case "ok":
      return card(
        <>
          <h1 className="text-2xl sm:text-3xl mb-2">{t("successTitle")}</h1>
          <p className="text-ink-2 mb-6">
            {t("successBody", { name: outcome.firstName })}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={path("account/login") + `?next=${encodeURIComponent(`/account/bookings/${outcome.iscrizioneId}/receipts`)}`}
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
            <Link href={path("account/login")} className="btn btn-primary">
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