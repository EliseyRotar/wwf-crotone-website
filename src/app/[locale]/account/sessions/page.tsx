import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";
import { DEVICE_COOKIE_NAME, verifyDeviceCookie } from "@/lib/deviceSession";
import AccountSessionsClient from "@/components/features/AccountSessionsClient";

export const dynamic = "force-dynamic";

/**
 * /[locale]/account/sessions — list all active DeviceSession rows
 * for the current volunteer, with a button to revoke each one and a
 * "sign out everywhere else" button.
 *
 * Server component: fetches the data and renders the list as a
 * client island (so the revoke buttons can call DELETE).
 */
export default async function AccountSessionsPage({
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

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  const ua = (await headers()).get("user-agent") ?? "";
  const al = (await headers()).get("accept-language") ?? "";
  const verified = cookieVal ? verifyDeviceCookie(cookieVal, ua, al) : { ok: false as const };

  const [rows, current] = await Promise.all([
    prisma.deviceSession.findMany({
      where: { userId: session.iscrizioneId, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" }
    }),
    verified.ok
      ? prisma.deviceSession.findFirst({
          where: { userId: session.iscrizioneId, deviceHash: verified.deviceHash },
          select: { id: true }
        })
      : Promise.resolve(null)
  ]);

  const currentId = current?.id ?? null;

  const sessionsForClient = rows.map((r) => ({
    id: r.id,
    userAgent: r.userAgent,
    ipAddress: r.ipAddress,
    lastSeenAt: r.lastSeenAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    isCurrent: currentId !== null && r.id === currentId
  }));

  const t = await getTranslations({ locale, namespace: "Account.sessions" });

  return (
    <main className="container section max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl mb-2">{t("title")}</h1>
        <p className="text-sm text-ink-grey">{t("intro")}</p>
      </header>
      <AccountSessionsClient initial={sessionsForClient} labels={{
        revoke: t("revoke"),
        revokeOthers: t("revokeOthers"),
        currentLabel: t("currentLabel"),
        never: t("never"),
        browserFallback: t("browserFallback"),
        expiresOn: t("expiresOn"),
        lastSeen: t("lastSeen"),
        backLink: t("backLink"),
        empty: t("empty"),
        error: t("error"),
        confirming: t("confirming")
      }} locale={locale} />
    </main>
  );
}