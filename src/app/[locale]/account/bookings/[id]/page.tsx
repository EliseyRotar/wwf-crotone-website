import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { prisma } from "@/lib/prisma";
import { fmtDateRange } from "@/lib/turns";
import {
  EDITABLE_FIELDS,
  lockReasonFor,
  FIELD_LABELS
} from "@/lib/bookingLock";
import BookingDetailClient from "@/components/features/BookingDetailClient";

/**
 * /[locale]/account/bookings/[id] — the booking detail / edit page.
 *
 * Server component. Loads the Iscrizione, verifies it belongs to the
 * current volunteer (email match), and renders the editable form.
 * If the booking belongs to a different user, we 404 — never expose
 * the existence of someone else's row.
 *
 * Locking rules:
 *   - Turno.startDate in the past → ALL editable fields are read-only.
 *   - Iscrizione.personalDataLockedAt set → personal data + consensi
 *     fields are read-only; health + logistics remain editable until
 *     the turno starts.
 */
export default async function AccountBookingDetailPage({
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
      turno: {
        select: { id: true, number: true, startDate: true, endDate: true }
      },
      iscrizioneTurni: {
        include: { turno: { select: { id: true, number: true, startDate: true, endDate: true } } }
      }
    }
  });

  if (!iscrizione) notFound();

  // Ownership check: same email, or row IS the session row. Never leak
  // a foreign booking's existence.
  const sessionEmail = session.email.toLowerCase();
  const ownerOk =
    iscrizione.id === session.iscrizioneId ||
    iscrizione.email.toLowerCase() === sessionEmail;
  if (!ownerOk) notFound();

  const t = await getTranslations("Account.bookings");

  // Build a locked-field map: fieldName -> lockReason | "ok"
  // The client uses this to render inputs as disabled / read-only and
  // to surface the per-section banner.
  const lockState: Record<string, "ok" | "personal-data-locked" | "turno-started"> = {};
  for (const f of EDITABLE_FIELDS) {
    const reason = lockReasonFor(f, iscrizione);
    lockState[f] = reason ?? "ok";
  }

  // Pre-stringify the field values into something the client can
  // pass straight into inputs.
  const initialValues: Record<string, string | boolean> = {
    firstName: iscrizione.firstName,
    lastName: iscrizione.lastName,
    birthDate: iscrizione.birthDate ? iscrizione.birthDate.toISOString().slice(0, 10) : "",
    age: iscrizione.age != null ? String(iscrizione.age) : "",
    email: iscrizione.email,
    phone: iscrizione.phone,
    isMinor: iscrizione.isMinor,
    guardianName: iscrizione.guardianName ?? "",
    guardianEmail: iscrizione.guardianEmail ?? "",
    guardianPhone: iscrizione.guardianPhone ?? "",
    guardianConsent: iscrizione.guardianConsent,
    allergies: iscrizione.allergies ?? "",
    medications: iscrizione.medications ?? "",
    swimmingAbility: iscrizione.swimmingAbility ?? "",
    tetanusStatus: iscrizione.tetanusStatus ?? "",
    fitnessSelf: iscrizione.fitnessSelf ?? "",
    dietaryNeeds: iscrizione.dietaryNeeds ?? "",
    dietaryNotes: iscrizione.dietaryNotes ?? "",
    tshirtSize: iscrizione.tshirtSize ?? "",
    arrivalMode: iscrizione.arrivalMode ?? "",
    arrivalTime: iscrizione.arrivalTime ?? "",
    departureTime: iscrizione.departureTime ?? "",
    privacyConsent: iscrizione.privacyConsent,
    marketingConsent: iscrizione.marketingConsent,
    imageDataConsent: iscrizione.imageDataConsent
  };

  // Determine status-driven receipt slot:
  // - Show "Upload deposit" if !feePaid && status !== 'cancelled'
  // - Show "Upload balance" if feePaid && !balancePaid && status !== 'cancelled'
  // - Show "payment complete" green card if both paid
  const receiptSlot: "deposit" | "balance" | "complete" | "none" = (() => {
    if (iscrizione.status === "cancelled") return "none";
    if (iscrizione.feePaid && iscrizione.balancePaid) return "complete";
    if (!iscrizione.feePaid) return "deposit";
    return "balance";
  })();

  return (
    <div className="container section max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-ink-grey">
          <Link href={`/${locale}/account/bookings`} className="hover:underline">
            ← {t("backToList")}
          </Link>
        </p>
        <h1 className="text-3xl md:text-4xl mb-2">
          {t("editBookingTitle", {
            name: `${iscrizione.firstName} ${iscrizione.lastName}`
          })}
        </h1>
        <p className="text-ink-2">
          {t("campLabel", { number: iscrizione.turno.number })} —{" "}
          {fmtDateRange(iscrizione.turno.startDate, iscrizione.turno.endDate, locale)}
        </p>
      </header>

      <BookingDetailClient
        iscrizioneId={iscrizione.id}
        initialValues={initialValues}
        lockState={lockState}
        receiptSlot={receiptSlot}
        status={iscrizione.status}
        feePaid={iscrizione.feePaid}
        balancePaid={iscrizione.balancePaid}
        depositReceiptApprovedAt={
          iscrizione.depositReceiptApprovedAt
            ? iscrizione.depositReceiptApprovedAt.toISOString()
            : null
        }
        balanceReceiptApprovedAt={
          iscrizione.balanceReceiptApprovedAt
            ? iscrizione.balanceReceiptApprovedAt.toISOString()
            : null
        }
        depositReceiptUploadedAt={
          iscrizione.depositReceiptUploadedAt
            ? iscrizione.depositReceiptUploadedAt.toISOString()
            : null
        }
        balanceReceiptUploadedAt={
          iscrizione.balanceReceiptUploadedAt
            ? iscrizione.balanceReceiptUploadedAt.toISOString()
            : null
        }
        locale={locale}
        labels={collectFieldLabels(t)}
        sectionLabels={{
          anagrafica: t("sectionAnagrafica"),
          salute: t("sectionSalute"),
          logistica: t("sectionLogistica"),
          consensi: t("sectionConsensi"),
          pagamento: t("sectionPagamento"),
          save: t("save"),
          saving: t("saving"),
          saved: t("saved"),
          saveError: t("saveError"),
          lockedFieldsNotice: t("lockedFieldsNotice"),
          turnoStartedNotice: t("turnoStartedNotice"),
          uploadReceipt: t("uploadReceipt"),
          paymentComplete: t("paymentComplete"),
          pendingApproval: t("pendingApproval"),
          changeHistory: t("changeHistory"),
          approved: t("approved"),
          fee100: t("fee100"),
          balance: t("balance"),
          ibanHelp: t("ibanHelp"),
          balanceAmount: t("balanceAmount", {
            amount: computeBalanceAmount(iscrizione)
          }),
          ibanLink: t("ibanLink")
        }}
      />
    </div>
  );
}

/**
 * Pull every field label out of the i18n namespace in one pass.
 * Returns a flat `{ <fieldName>: translatedLabel }` record the client
 * can index into directly.
 */
function collectFieldLabels(t: (key: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of EDITABLE_FIELDS) {
    const meta = FIELD_LABELS[f];
    if (meta) {
      try {
        out[f] = t(`field.${meta.label}`);
      } catch {
        out[f] = f;
      }
    } else {
      out[f] = f;
    }
  }
  return out;
}

/**
 * The balance amount is camp_cost - 100 (registration fee). We do not
 * have a stored "totalCost" on the Iscrizione, so we recompute it from
 * the number of turns. The lookup-cookie path uses a hard-coded 430
 * (non-member price); the personal area should match the same simple
 * formula. A future pass can add a stored total to Iscrizione.
 */
function computeBalanceAmount(iscrizione: {
  iscrizioneTurni: { isPrimary: boolean }[];
}): number {
  const weeks = Math.max(1, iscrizione.iscrizioneTurni.length);
  const costPerWeek = 430; // matches /mio-iscrizione and the public form
  return Math.max(0, weeks * costPerWeek - 100);
}
