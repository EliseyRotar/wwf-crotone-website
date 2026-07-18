import { setRequestLocale, getTranslations } from "next-intl/server";
import MyRegistrationClient from "@/components/MyRegistrationClient";

export default async function MyRegistrationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyRegistrationClient />;
}