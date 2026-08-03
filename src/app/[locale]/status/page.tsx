import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

/**
 * /[locale]/status — thin wrapper that redirects to the Instatus public
 * status page. We use Instatus free tier and CNAME status.wwfcrotone.it
 * to it.
 */
const INSTATUS_URL = "https://status.wwfcrotone.it";

export default async function StatusPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(INSTATUS_URL);
}