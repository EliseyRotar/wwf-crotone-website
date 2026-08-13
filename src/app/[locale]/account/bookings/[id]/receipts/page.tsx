import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/turns";
import ReceiptUploader from "@/components/features/ReceiptUploader";

/**
 * /[locale]/account/bookings/[id]/receipts — receipt upload page.
 *
 * Status-driven UI: only the NEXT open receipt slot is shown.
 *   - If !feePaid && status !== 'cancelled' → upload €100 deposit.
 *   - If feePaid && !balancePaid && status !== 'cancelled' → upload
 *     balance.
 *   - If both paid → "Pagamento completo" green card.
 *   - If status === 'cancelled' → no slot is open.
 *
 * Files are submitted to /api/account/booking/[id]/receipt (multipart
 * form-data, JPEG/PNG/PDF, max 5MB, magic-byte validated server-side).
 * After upload, the matching `*ReceiptUrl` and `*ReceiptUploadedAt` are
 * set; the admin still has to verify from /admin/iscrizioni to flip
 * the `*ApprovedAt` columns and clear the "pending approval" state.
 */
export default async function AccountBookingReceiptsPage({
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
    include: {
      turno: { select: { number: true, startDate: true, endDate: true } },
      iscrizioneTurni: { select: { id: true, isPrimary: true } }
    }
  });
  if (!iscrizione) notFound();
  if (
    iscrizione.id !== session.iscrizioneId &&
    iscrizione.email.toLowerCase() !== session.email.toLowerCase()
  ) {
    notFound();
  }

  const t = await getTranslations("Account.bookings.receipts");

  const slot: "deposit" | "balance" | "complete" | "none" = (() => {
    if (iscrizione.status === "cancelled") return "none";
    if (iscrizione.feePaid && iscrizione.balancePaid) return "complete";
    if (!iscrizione.feePaid) return "deposit";
    return "balance";
  })();

  const balanceAmount = Math.max(
    0,
    Math.max(1, iscrizione.iscrizioneTurni?.length ?? 1) * 430 - 100
  );

  return (
    <div className="container section max-w-2xl space-y-6">
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
          {t("subtitle", { name: `${iscrizione.firstName} ${iscrizione.lastName}` })}
        </p>
      </header>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <PaymentSummary
              label={t("fee100")}
              paid={iscrizione.feePaid}
              approvedAt={iscrizione.depositReceiptApprovedAt}
              uploadedAt={iscrizione.depositReceiptUploadedAt}
              url={iscrizione.depositReceiptUrl}
              locale={locale}
              approvedLabel={t("approved")}
              pendingLabel={t("pendingApproval")}
              notPaidLabel={t("notPaid")}
            />
            <PaymentSummary
              label={t("balance")}
              paid={iscrizione.balancePaid}
              approvedAt={iscrizione.balanceReceiptApprovedAt}
              uploadedAt={iscrizione.balanceReceiptUploadedAt}
              url={iscrizione.balanceReceiptUrl}
              locale={locale}
              approvedLabel={t("approved")}
              pendingLabel={t("pendingApproval")}
              notPaidLabel={t("notPaid")}
            />
          </div>

          {slot === "complete" && (
            <div className="rounded-md border border-wwf-green/40 bg-wwf-green/10 px-4 py-3 text-sm">
              ✓ {t("paymentComplete")}
            </div>
          )}

          {slot === "deposit" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-2">
                {t("depositHelp", { amount: 100 })}{" "}
                <Link className="underline" href={`/${locale}/contact`}>
                  {t("ibanLink")}
                </Link>
                .
              </p>
              <ReceiptUploader
                iscrizioneId={iscrizione.id}
                type="deposit"
              />
            </div>
          )}

          {slot === "balance" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-2">
                {t("balanceHelp", { amount: balanceAmount })}
              </p>
              <ReceiptUploader
                iscrizioneId={iscrizione.id}
                type="balance"
              />
            </div>
          )}

          {slot === "none" && iscrizione.status === "cancelled" && (
            <div className="rounded-md border border-ink-line px-4 py-3 text-sm text-ink-2">
              {t("cancelledNotice")}
            </div>
          )}

          <p className="text-xs text-ink-grey">{t("approvalFootnote")}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentSummary({
  label,
  paid,
  approvedAt,
  uploadedAt,
  url,
  locale,
  approvedLabel,
  pendingLabel,
  notPaidLabel
}: {
  label: string;
  paid: boolean;
  approvedAt: Date | null;
  uploadedAt: Date | null;
  url: string | null;
  locale: string;
  approvedLabel: string;
  pendingLabel: string;
  notPaidLabel: string;
}) {
  let status: React.ReactNode = "—";
  if (paid && approvedAt) status = <span className="text-tag-green">✓ {approvedLabel}</span>;
  else if (paid) status = <span className="text-tag-green">✓</span>;
  else if (uploadedAt) {
    status = (
      <div>
        <span className="text-ink-2">{pendingLabel}</span>
        {url && (
          <p className="text-xs">
            <Link href={url} target="_blank" rel="noreferrer" className="underline">
              {fmtDate(uploadedAt, locale)}
            </Link>
          </p>
        )}
      </div>
    );
  } else status = <span className="text-ink-grey">{notPaidLabel}</span>;
  return (
    <div className="rounded-md border border-ink-line p-2">
      <div className="text-xs text-ink-grey">{label}</div>
      <div className="font-medium">{status}</div>
    </div>
  );
}
