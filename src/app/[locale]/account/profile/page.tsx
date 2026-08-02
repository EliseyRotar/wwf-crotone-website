import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import AccountProfileClient from "@/components/features/AccountProfileClient";

/**
 * /[locale]/account/profile — Phase 1 entry point for the GDPR
 * delete request flow. The per-field booking edit UI lands here in a
 * later phase; for now we just render the delete form.
 */
export default async function AccountProfilePage({
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
  if (!session) return null;

  const t = await getTranslations("Account.profile");
  return (
    <AccountProfileClient
      email={session.email}
      locale={locale}
      labels={{
        title: t("title"),
        intro: t("intro"),
        sectionGdpr: t("sectionGdpr"),
        gdprBody: t("gdprBody"),
        reasonLabel: t("reasonLabel"),
        reasonPlaceholder: t("reasonPlaceholder"),
        confirmLabel: t("confirmLabel", { email: session.email }),
        submit: t("submit"),
        submitting: t("submitting"),
        successTitle: t("successTitle"),
        successBody: t("successBody"),
        back: t("back")
      }}
    />
  );
}
