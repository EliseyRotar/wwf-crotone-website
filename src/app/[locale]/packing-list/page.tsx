import { setRequestLocale, getTranslations } from "next-intl/server";
import PackingListClient from "@/components/PackingListClient";

export default async function PackingListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PackingListClient />;
}