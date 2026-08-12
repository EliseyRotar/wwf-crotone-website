import { redirect } from "next/navigation";

/**
 * /[locale]/mio-iscrizione — legacy personal-area entry point.
 *
 * The dashboard now lives at /[locale]/account and the bookings list
 * at /[locale]/account/bookings. We redirect both so any external
 * link (email, social, etc.) still works.
 */
export default async function MyRegistrationPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/account/bookings`);
}