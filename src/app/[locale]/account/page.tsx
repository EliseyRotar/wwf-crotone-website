import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import AccountHomeClient from "@/components/features/AccountHomeClient";

/**
 * /[locale]/account — the personal area landing page.
 *
 * Server component: if there's a valid session cookie, renders the
 * dashboard; otherwise redirects to /account/login. We do this in a
 * server component (not a client-side `useEffect`) so:
 *   - the redirect happens before any HTML is sent (no flicker)
 *   - the dashboard renders fully on first paint for crawlers/share
 *     previewers, with the right text direction
 */
export default async function AccountHomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getAccountSession();
  if (!session) {
    redirect(`/${locale}/account/login`);
  }

  // session is non-null here but TypeScript can't follow the redirect
  // narrowing; re-check to keep the strict compiler happy.
  const t = await getTranslations("Account.dashboard");
  if (!session) return null;
  return (
    <AccountHomeClient
      firstName={session.firstName}
      lastName={session.lastName}
      email={session.email}
      persistent={session.persistent}
      locale={locale}
      labels={{
        welcome: t("welcome", { name: session.firstName }),
        intro: t("intro"),
        profile: t("profile"),
        logout: t("logout"),
        sessions: t("sessions"),
        sessionsBody: t("sessionsBody"),
        gdpr: t("gdpr"),
        gdprBody: t("gdprBody"),
        myRegistration: t("myRegistration"),
        myBookings: t("myBookings"),
        myBookingsBody: t("myBookingsBody")
      }}
    />
  );
}
