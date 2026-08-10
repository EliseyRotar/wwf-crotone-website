/**
 * /[locale]/status — public status page server component.
 *
 * Reads StatusOverview from the DB on the server (no client fetch needed
 * for the initial paint). The page also embeds a small client component
 * that auto-refreshes data every 30s via the public API.
 *
 * Removed the previous "redirect to Instatus" behavior — Instatus is
 * deprecated. The cf-2025-08 plan is to host the canonical status page
 * at status.wwfcrotone.it (this page, served by the same Next.js app
 * under a different nginx vhost).
 */
import { headers } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getStatusOverview } from "@/lib/status";
import StatusOverviewClient from "@/components/features/StatusOverviewClient";

export const dynamic = "force-dynamic";

export default async function StatusPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Status" });

  const data = await getStatusOverview(locale);

  // Read CSP nonce so the embedded bootstrap script is allowed by the
  // strict CSP (no 'unsafe-inline'): the StatusOverviewClient uses
  // fetch() so it doesn't need inline scripts, but the page wrapper
  // attaches a small footprint here.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <div className="container section max-w-5xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-ink-grey">{t("subtitle")}</p>
      </header>

      <StatusOverviewClient initial={data} locale={locale} nonce={nonce} />

      <p className="mt-10 text-xs text-ink-grey">{t("poweredBy")}</p>
    </div>
  );
}
