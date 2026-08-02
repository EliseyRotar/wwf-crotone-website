import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { findBookingsForVolunteer } from "@/lib/bookings";
import { fmtDateRange } from "@/lib/turns";

/**
 * /[locale]/account/bookings — the personal area's bookings list.
 *
 * Server component. Reads the current session, resolves all
 * Iscrizione rows for that volunteer's email, and renders them as
 * status cards. The user is identified by the Iscrizione row behind
 * the session cookie (see src/lib/bookings.ts for the resolution
 * rule); we deliberately include all rows under the same email so
 * someone with multiple turns sees them all in one place.
 */
export default async function AccountBookingsListPage({
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

  const t = await getTranslations("Account.bookings");

  const bookings = await findBookingsForVolunteer({
    iscrizioneId: session.iscrizioneId,
    email: session.email
  });

  return (
    <div className="container section max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl mb-2">{t("title")}</h1>
        <p className="text-ink-2">{t("intro")}</p>
      </header>

      {bookings.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <p className="text-ink-2">{t("noBookings")}</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="account-bookings-list">
          {bookings.map((b) => {
            const extraTurns = b.iscrizioneTurni
              .filter((it) => !it.isPrimary)
              .map((it) => it.turno);
            return (
              <li key={b.id} className="card">
                <div className="card-body space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {b.firstName} {b.lastName} — {t("campLabel", { number: b.turno.number })}
                      </h2>
                      <p className="text-sm text-ink-grey">
                        {fmtDateRange(b.turno.startDate, b.turno.endDate, locale)}
                      </p>
                      {extraTurns.length > 0 && (
                        <p className="text-xs text-ink-grey mt-1">
                          {t("alsoBooked", {
                            list: extraTurns
                              .map((t2) => t("campLabel", { number: t2.number }))
                              .join(", ")
                          })}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={b.status} />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    <PaymentCell
                      label={t("fee100")}
                      paid={b.feePaid}
                      uploadedAt={b.depositReceiptUploadedAt}
                      paidLabel={t("paid")}
                      pendingLabel={t("pendingApproval")}
                      notPaidLabel={t("notPaid")}
                    />
                    <PaymentCell
                      label={t("balance")}
                      paid={b.balancePaid}
                      uploadedAt={b.balanceReceiptUploadedAt}
                      paidLabel={t("paid")}
                      pendingLabel={t("pendingApproval")}
                      notPaidLabel={t("notPaid")}
                    />
                    <ReceiptStatusCell
                      feePaid={b.feePaid}
                      balancePaid={b.balancePaid}
                      hasUploaded={
                        !!b.depositReceiptUploadedAt || !!b.balanceReceiptUploadedAt
                      }
                      notPaidLabel={t("notPaid")}
                      completeLabel={t("paymentComplete")}
                      pendingLabel={t("pendingApproval")}
                      paymentStatusLabel={t("paymentStatus")}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="btn btn-primary"
                      href={`/${locale}/account/bookings/${b.id}`}
                    >
                      {t("openBooking")}
                    </Link>
                    <Link
                      className="btn btn-secondary"
                      href={`/${locale}/account/bookings/${b.id}/history`}
                    >
                      {t("changeHistory")}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <Link className="text-sm text-ink-2 hover:underline" href={`/${locale}/account`}>
          ← {t("back")}
        </Link>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { className: string }> = {
    pending: { className: "tag tag-grey" },
    confirmed: { className: "tag tag-blue" },
    paid: { className: "tag tag-green" },
    cancelled: { className: "tag tag-red" },
    waitlist: { className: "tag tag-orange" }
  };
  const entry = map[status] ?? { className: "tag tag-grey" };
  return <span className={entry.className}>{status}</span>;
}

function PaymentCell({
  label,
  paid,
  uploadedAt,
  paidLabel,
  pendingLabel,
  notPaidLabel
}: {
  label: string;
  paid: boolean;
  uploadedAt: Date | null;
  paidLabel: string;
  pendingLabel: string;
  notPaidLabel: string;
}) {
  return (
    <div className="rounded-md border border-ink-line p-2">
      <div className="text-xs text-ink-grey">{label}</div>
      <div className="font-medium">
        {paid ? (
          <span className="text-tag-green">✓ {paidLabel}</span>
        ) : uploadedAt ? (
          <span className="text-ink-2">{pendingLabel}</span>
        ) : (
          <span className="text-ink-grey">{notPaidLabel}</span>
        )}
      </div>
    </div>
  );
}

function ReceiptStatusCell({
  feePaid,
  balancePaid,
  hasUploaded,
  notPaidLabel,
  completeLabel,
  pendingLabel,
  paymentStatusLabel
}: {
  feePaid: boolean;
  balancePaid: boolean;
  hasUploaded: boolean;
  notPaidLabel: string;
  completeLabel: string;
  pendingLabel: string;
  paymentStatusLabel: string;
}) {
  let label = notPaidLabel;
  let tone = "text-ink-grey";
  if (feePaid && balancePaid) {
    label = completeLabel;
    tone = "text-tag-green";
  } else if (hasUploaded) {
    label = pendingLabel;
    tone = "text-ink-2";
  }
  return (
    <div className="rounded-md border border-ink-line p-2">
      <div className="text-xs text-ink-grey">{paymentStatusLabel}</div>
      <div className={`font-medium ${tone}`}>{label}</div>
    </div>
  );
}
