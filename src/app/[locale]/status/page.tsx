import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

/**
 * /[locale]/status — thin wrapper that redirects to the Instatus public
 * status page. We use Instatus free tier and a Cloudflare CNAME from
 * status.wwfcrotone.it to the Instatus instance below.
 */
const INSTATUS_URL = "https://wwfcrotone.instatus.com";

export default async function StatusPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(INSTATUS_URL);
}