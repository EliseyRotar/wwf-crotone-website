import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

/**
 * The actual token consumption happens in /api/account/redeem which
 * sets the session cookie and 303-redirects to /[locale]/account.
 *
 * If a user reaches /[locale]/account/redeem directly (no `?token=`
 * in the URL, or with a malformed query), we send them to the login
 * page — there's nothing useful we can render here.
 */
export default async function AccountRedeemPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ token?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = (await searchParams) ?? {};
  const errorQS = sp.error ? `?error=${encodeURIComponent(sp.error)}` : "";
  // If a token is in the URL we still go through the API so the
  // session cookie is set correctly.
  if (sp.token) {
    redirect(`/api/account/redeem?token=${encodeURIComponent(sp.token)}&locale=${locale}`);
  }
  redirect(`/${locale}/account/login${errorQS}`);
}
