import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { prisma } from "@/lib/prisma";
import { FIELD_LABELS } from "@/lib/bookingLock";
import { fmtDate } from "@/lib/turns";

/**
 * /[locale]/account/bookings/[id]/history — change-history timeline.
 *
 * Reads every AuditLog row with `entity = "iscrizione"` and
 * `entityId = id`. We render a vertical timeline with timestamp,
 * field name, before → after, and a context line (IP + UA when
 * present). Rows whose `fieldName` is null are treated as coarse
 * events (status changes, login, GDPR request, etc.) and shown in
 * their own section above the field changes.
 *
 * Ownership check: same as the edit page — same id as the session or
 * same email. We 404 on mismatch so we never leak the existence of
 * a foreign booking.
 */
export default async function AccountBookingHistoryPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getAccountSession();
  if (!session) {
    redirect(`/${locale}/account/login`);
  }
  if (!session) return null;

  const iscrizione = await prisma.iscrizione.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  if (!iscrizione) notFound();
  if (
    iscrizione.id !== session.iscrizioneId &&
    iscrizione.email.toLowerCase() !== session.email.toLowerCase()
  ) {
    notFound();
  }

  const t = await getTranslations("Account.bookings.history");

  const rows = await prisma.auditLog.findMany({
    where: { entity: "iscrizione", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const fieldChanges = rows.filter((r) => r.fieldName);
  const coarse = rows.filter((r) => !r.fieldName);

  return (
    <div className="container section max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-ink-grey">
          <Link
            href={`/${locale}/account/bookings/${id}`}
            className="hover:underline"
          >
            ← {t("backToBooking")}
          </Link>
        </p>
        <h1 className="text-3xl md:text-4xl mb-2">{t("title")}</h1>
        <p className="text-ink-2">
          {t("subtitle", {
            name: `${iscrizione.firstName} ${iscrizione.lastName}`
          })}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <p className="text-ink-2">{t("noEvents")}</p>
          </div>
        </div>
      ) : (
        <>
          {fieldChanges.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("fieldChanges")}</h2>
              <ol className="space-y-3" data-testid="history-timeline">
                {fieldChanges.map((r) => {
                  const meta = r.fieldName ? FIELD_LABELS[r.fieldName] : null;
                  let label = r.fieldName ?? "";
                  if (meta?.label) {
                    try {
                      label = t(`fieldLabels.${meta.label}`);
                    } catch {
                      label = r.fieldName ?? "";
                    }
                  }
                  return (
                    <li key={r.id} className="card">
                      <div className="card-body space-y-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="font-medium">{label}</div>
                          <time
                            dateTime={r.createdAt.toISOString()}
                            className="text-xs text-ink-grey"
                          >
                            {fmtDate(r.createdAt, locale)} —{" "}
                            {r.createdAt.toLocaleTimeString(
                              locale === "it" ? "it-IT" : "en-GB",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </time>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md border border-ink-line p-2">
                            <div className="text-xs text-ink-grey">{t("before")}</div>
                            <div className="font-mono break-words">
                              {formatValue(r.oldValue)}
                            </div>
                          </div>
                          <div className="rounded-md border border-ink-line p-2">
                            <div className="text-xs text-ink-grey">{t("after")}</div>
                            <div className="font-mono break-words">
                              {formatValue(r.newValue)}
                            </div>
                          </div>
                        </div>
                        {(r.ipAddress || r.userAgent) && (
                          <p className="text-xs text-ink-grey">
                            {r.ipAddress && (
                              <span>
                                IP: <span className="font-mono">{r.ipAddress}</span>
                              </span>
                            )}
                            {r.ipAddress && r.userAgent && " · "}
                            {r.userAgent && (
                              <span className="line-clamp-1 inline">
                                UA: <span className="font-mono">{r.userAgent}</span>
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {coarse.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("otherEvents")}</h2>
              <ul className="space-y-2">
                {coarse.map((r) => (
                  <li key={r.id} className="card">
                    <div className="card-body">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <span className="tag tag-grey text-xs mr-2">
                            {r.action}
                          </span>
                          {r.details && (
                            <span className="text-sm text-ink-2">{r.details}</span>
                          )}
                        </div>
                        <time
                          dateTime={r.createdAt.toISOString()}
                          className="text-xs text-ink-grey"
                        >
                          {fmtDate(r.createdAt, locale)} —{" "}
                          {r.createdAt.toLocaleTimeString(
                            locale === "it" ? "it-IT" : "en-GB",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </time>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function formatValue(v: string | null): string {
  if (v === null) return "—";
  if (v === "null") return "—";
  if (v === "") return "(vuoto)";
  return v;
}
