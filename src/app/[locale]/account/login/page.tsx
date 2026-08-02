import { setRequestLocale, getTranslations } from "next-intl/server";
import AccountLoginClient from "@/components/features/AccountLoginClient";

export default async function AccountLoginPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountLoginClient />;
}
