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
 *
 * Note on i18n: next-intl parses every translation string as ICU
 * MessageFormat. If you call `t("lastSeen")` (without values) on a
 * message that contains `{when}`, ICU treats `{when}` as an undefined
 * placeholder and the translation library falls back to the key path
 * (`"Account.sessions.lastSeen"`) instead of the raw string. So we
 * interpolate server-side and pass already-formatted text to the
 * client island.
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

  const t = await getTranslations("Account.sessions");
  const tRelative = await getTranslations("RelativeTime");
  const now = Date.now();

  const sessionsForClient = rows.map((r) => {
    const lastSeenAt = r.lastSeenAt.toISOString();
    const expiresAt = r.expiresAt.toISOString();
    return {
      id: r.id,
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      lastSeenAt,
      expiresAt,
      isCurrent: currentId !== null && r.id === currentId,
      lastSeenLabel: t("lastSeen", { when: fmtRelative(lastSeenAt, now, tRelative) }),
      expiresOnLabel: t("expiresOn", { date: fmtDate(expiresAt, locale) })
    };
  });

  return (
    <main className="container section max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl mb-2">{t("title")}</h1>
        <p className="text-sm text-ink-grey">{t("intro")}</p>
      </header>
      <AccountSessionsClient
        initial={sessionsForClient}
        labels={{
          revoke: t("revoke"),
          revokeOthers: t("revokeOthers"),
          currentLabel: t("currentLabel"),
          browserFallback: t("browserFallback"),
          backLink: t("backLink"),
          empty: t("empty"),
          error: t("error")
        }}
      />
    </main>
  );
}

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function fmtRelative(iso: string, nowMs: number, t: (key: string, values?: Record<string, string | number>) => string): string {
  const tMs = new Date(iso).getTime();
  if (!Number.isFinite(tMs)) return t("never");
  const diff = nowMs - tMs;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t("now");
  if (min < 60) return t("minutes", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("hours", { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t("days", { n: d });
  return fmtDate(iso, "it");
}
