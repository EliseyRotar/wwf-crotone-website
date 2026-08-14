import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { findBookingsForVolunteer } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import LogoutLink from "@/components/features/LogoutLink";
import {
  CalendarDays,
  Check,
  ListChecks,
  MapPin,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Plane,
  Train,
  Bus,
  Ship,
  Car,
  HelpCircle,
  Phone,
  Plus,
  Wallet,
  AlertTriangle,
  Wallet2,
  ExternalLink,
  Coins
} from "lucide-react";

export const dynamic = "force-dynamic";

type Booking = Awaited<ReturnType<typeof findBookingsForVolunteer>>[number];

// Total camp cost (€) — deposit €100 + balance (per-turn amount minus 100)
// We don't know the exact per-turn amount on the client; we use the
// fee €100 + balance paid status as a proxy for "what's still due".
// The dashboard reads balancePaid to compute a soft total.
const DEPOSIT_EUR = 100;

type T = Awaited<ReturnType<typeof getTranslations>>;

/**
 * /[locale]/account — the personal area home.
 *
 * Reorganised for clarity, mobile-first, and multi-camp volunteers.
 * Sections (single column, stacked on small screens):
 *
 *   1. Welcome + session chip
 *   2. Aggregate summary card — "X campi · Y in arrivo · €N da versare"
 *   3. Next-camp card (the most-imminent upcoming booking) — large,
 *      with countdown, status, payment state, arrival info, CTAs
 *   4. All camps stacked (upcoming + past) — each card has its own
 *      status, payment summary, arrival summary, and CTAs
 *   5. "Book another camp" CTA
 *   6. Quick links
 *   7. Account row (profile / devices / logout)
 *
 * Two-state design:
 *   - Has bookings → everything above.
 *   - No bookings   → welcome + a single empty-state card.
 *
 * Logout is the only client island.
 */
export default async function AccountHomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const path = (p: string) => `/${locale}/${p}`;

  const session = await getAccountSession();
  if (!session) {
    redirect(path("account/login"));
  }

  const t = await getTranslations("Account.dashboardV2");
  const tBookings = await getTranslations("Account.bookings");

  const [bookings, deviceCount, settings] = await Promise.all([
    findBookingsForVolunteer({ iscrizioneId: session.iscrizioneId, email: session.email }),
    prisma.deviceSession.count({
      where: { userId: session.iscrizioneId, expiresAt: { gt: new Date() } }
    }),
    prisma.campSettings.findFirst({ select: { costNonMember: true, costMember: true } })
  ]);

  const now = new Date();

  // ─── Sort: upcoming first (by start date asc), then past (start desc) ───
  const enriched = bookings.map((b) => ({
    ...b,
    isPast: b.turno.endDate.getTime() < now.getTime()
  }));
  const upcoming = enriched
    .filter((b) => !b.isPast)
    .sort((a, b) => a.turno.startDate.getTime() - b.turno.startDate.getTime());
  const past = enriched
    .filter((b) => b.isPast)
    .sort((a, b) => b.turno.startDate.getTime() - a.turno.startDate.getTime());
  const sortedBookings = [...upcoming, ...past];

  const nextCamp = upcoming[0];

  // ─── Aggregate metrics ───
  const totalCamps = sortedBookings.length;
  const totalUpcoming = upcoming.length;
  const totalPast = past.length;

  // Compute total still due across ALL bookings.
  // Per booking:
  //   - If status is "paid" or "confirmed" AND balancePaid → €0 owed
  //   - Else: 100€ (deposit) if !feePaid
  //   - Else: balance if !balancePaid (estimate as one camp cost minus 100)
  // For simplicity we only show "€100" per missing deposit (we don't
  // know the full balance amount here, that's in CampSettings).
  const fullCampCost = settings?.costNonMember ?? 290; // typical 2026 price
  const balancePerCamp = Math.max(0, fullCampCost - DEPOSIT_EUR);
  let totalDue = 0;
  for (const b of sortedBookings) {
    if (!b.feePaid) totalDue += DEPOSIT_EUR;
    else if (!b.balancePaid && b.status !== "cancelled") totalDue += balancePerCamp;
  }

  // ─── Empty state ───
  if (totalCamps === 0) {
    return (
      <main className="container section max-w-3xl space-y-6">
        <WelcomeHeader session={session} t={t} locale={locale} path={path} />
        <EmptyState tEmpty={tBookings} t={t} locale={locale} path={path} />
      </main>
    );
  }

  return (
    <main className="container section max-w-3xl space-y-6">
      <WelcomeHeader session={session} t={t} locale={locale} path={path} />

      {/* Aggregate summary — always shown when ≥1 camp */}
      <SummaryCard
        totalCamps={totalCamps}
        totalUpcoming={totalUpcoming}
        totalPast={totalPast}
        totalDue={totalDue}
        nextCamp={nextCamp}
        locale={locale}
        t={t}
      />

      {/* All camps as individual cards, sorted upcoming-first then past.
          We render every booking — no max-3 cap, no "see all" link —
          because each camp needs its own status / payment / arrival
          sub-card for users with multiple bookings. */}
      <section aria-label={t("camp.sectionLabel")} className="space-y-3">
        <h2 className="sr-only">{t("camp.sectionLabel")}</h2>
        {sortedBookings.map((b) => (
          <CampCard
            key={b.id}
            booking={b}
            isNext={nextCamp?.id === b.id && totalUpcoming > 0}
            now={now}
            locale={locale}
            t={t}
            path={path}
          />
        ))}
        <Link
          href={path("dates")}
          className="block rounded-lg border-2 border-dashed border-[var(--c-border,#cecece)] bg-transparent hover:bg-[var(--c-sand,#f6f2ed)] transition-colors p-4 text-center"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--c-wwf-green,#007932)]">
            <Plus size={16} aria-hidden="true" />
            {t("camp.addAnotherCta")}
          </span>
        </Link>
      </section>

      <QuickLinks t={t} locale={locale} path={path} />
      <AccountRow
        email={session.email}
        deviceCount={deviceCount}
        t={t}
        path={path}
      />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Header
   ────────────────────────────────────────────────────────────────────── */

function WelcomeHeader({
  session,
  t,
  locale,
  path
}: {
  session: { firstName: string; email: string; persistent: boolean };
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  // Format the session-expiry date for the "session until" chip.
  // Cookie is either 24h (no remember) or 30d (with remember). We
  // approximate using the persistent flag + a 24h-now or 30d-now.
  const expiresAt = new Date(
    Date.now() + (session.persistent ? 30 : 24) * 60 * 60 * 1000
  );
  const expiresStr = expiresAt.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  void path;

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-ink-grey mb-1">
          {t("areaLabel")}
        </p>
        <h1 className="text-2xl md:text-3xl mb-1 break-words">
          {t("welcomeWithEmoji", { name: session.firstName })}
        </h1>
        <p className="text-sm text-ink-grey break-all">{session.email}</p>
      </div>
      <div className="flex flex-col items-end gap-1 text-xs">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
            session.persistent
              ? "bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)]"
              : "bg-[var(--c-tag-grey-bg,#cecece)] text-[var(--c-tag-grey-text,#262626)]"
          }`}
          title={t("sessionUntil", { date: expiresStr })}
        >
          <Check size={12} aria-hidden="true" />
          {session.persistent ? t("session30d") : t("sessionToday")}
        </span>
        <span className="text-[11px] text-ink-grey">{expiresStr}</span>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Summary card — total camps + total due + next-camp quick info
   ────────────────────────────────────────────────────────────────────── */

function SummaryCard({
  totalCamps,
  totalUpcoming,
  totalPast,
  totalDue,
  nextCamp,
  locale,
  t
}: {
  totalCamps: number;
  totalUpcoming: number;
  totalPast: number;
  totalDue: number;
  nextCamp: Booking | undefined;
  locale: string;
  t: T;
}) {
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
      day: "2-digit",
      month: "short"
    });
  return (
    <section
      aria-label={t("summary.label")}
      className="rounded-lg border border-[var(--c-border,#cecece)] bg-[var(--c-surface,#ffffff)] p-4 grid grid-cols-2 sm:grid-cols-3 gap-4"
    >
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-ink-grey font-semibold">
          {t("summary.label")}
        </p>
        <p className="text-lg font-semibold text-ink">
          {t("summary.campsCount", { count: totalCamps })}
        </p>
        <p className="text-xs text-ink-grey">
          {totalUpcoming > 0
            ? t("summary.campsCountUpcoming", {
                upcoming: totalUpcoming,
                past: totalPast
              })
            : totalPast > 0
            ? t("summary.campsCountUpcoming", {
                upcoming: 0,
                past: totalPast
              })
            : ""}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-ink-grey font-semibold inline-flex items-center gap-1">
          <Coins size={11} aria-hidden="true" />
          {totalDue > 0 ? t("summary.totalDue", { amount: totalDue }) : t("summary.totalDueNothing")}
        </p>
        <p className={`text-lg font-semibold ${totalDue > 0 ? "text-ink" : "text-[var(--c-wwf-green,#007932)]"}`}>
          {totalDue > 0 ? `€${totalDue}` : "✓"}
        </p>
        <p className="text-xs text-ink-grey">
          {nextCamp ? `${t("camp.camp", { number: nextCamp.turno.number })} · ${fmtDate(nextCamp.turno.startDate)}` : t("summary.nextCampNone")}
        </p>
      </div>

      <div className="space-y-1 col-span-2 sm:col-span-1">
        <p className="text-[10px] uppercase tracking-wider text-ink-grey font-semibold inline-flex items-center gap-1">
          <CalendarDays size={11} aria-hidden="true" />
          {t("summary.nextCampLabel")}
        </p>
        {nextCamp ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">{fmtDate(nextCamp.turno.startDate)} → {fmtDate(nextCamp.turno.endDate)}</span>
          </p>
        ) : (
          <p className="text-sm text-ink-grey">—</p>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Per-camp card — used for the next-camp and for every other booking
   ────────────────────────────────────────────────────────────────────── */

function CampCard({
  booking,
  isNext,
  now,
  locale,
  t,
  path
}: {
  booking: Booking;
  isNext: boolean;
  now: Date;
  locale: string;
  t: T;
  path: (p: string) => string;
}) {
  const { turno, status, receiptUploads } = booking;
  const isPast = turno.endDate.getTime() < now.getTime();
  const isInProgress =
    turno.startDate.getTime() <= now.getTime() && turno.endDate.getTime() >= now.getTime();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

  // Days-to-go
  const daysToGo = Math.max(0, Math.ceil((turno.startDate.getTime() - now.getTime()) / 86_400_000));
  let countdown: string;
  if (isPast) countdown = t("camp.countdown.past");
  else if (isInProgress) countdown = t("camp.countdown.inProgress", { day: "in corso", total: 7 });
  else if (daysToGo === 0) countdown = t("camp.countdown.today");
  else if (daysToGo === 1) countdown = t("camp.countdown.tomorrow");
  else countdown = t("camp.countdown.daysToGo", { days: daysToGo });

  // Deposit state — check approvedAt (more authoritative than feePaid)
  const depositUploads = (receiptUploads ?? []).filter((r) => r.type === "deposit");
  const balanceUploads = (receiptUploads ?? []).filter((r) => r.type === "balance");
  const depositApproved = depositUploads.some((r) => r.approvedAt);
  const depositPending = !depositApproved && depositUploads.length > 0;
  const balanceApproved = balanceUploads.some((r) => r.approvedAt);
  const hasBalanceRequired = !isPast; // balance not required for past camps

  const statusKeyMap: Record<string, string> = {
    pending: "pending",
    email_verified: "email_verified",
    receipt_uploaded: "receipt_uploaded",
    confirmed: "confirmed",
    paid: "paid",
    waitlist: "waitlist",
    cancelled: "cancelled"
  };
  const statusLabel = t(`camp.status.${statusKeyMap[status] ?? "pending"}`);

  const statusTone = (s: string) => {
    switch (s) {
      case "confirmed":
      case "paid":
        return "bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)] border-[var(--c-wwf-green,#007932)]";
      case "pending":
      case "email_verified":
      case "receipt_uploaded":
        return "bg-[var(--c-tag-orange-bg,#fef3c7)] text-[#92400e] border-[#f59e0b]";
      case "waitlist":
        return "bg-[var(--c-tag-grey-bg,#e5e7eb)] text-[var(--c-tag-grey-text,#374151)] border-[#9ca3af]";
      case "cancelled":
        return "bg-[var(--c-tag-red-bg,#fee2e2)] text-[var(--c-tag-red-text,#991b1b)] border-[var(--c-ink-red,#ed2b00)]";
      default:
        return "bg-[var(--c-tag-grey-bg,#cecece)] text-[var(--c-tag-grey-text,#262626)] border-[var(--c-border,#cecece)]";
    }
  };

  // Arrival info display
  const arrivalLines: string[] = [];
  if (booking.arrivalMode) {
    const modeLabel = t(`camp.arrival.mode.${booking.arrivalMode}`);
    arrivalLines.push(`✦ ${modeLabel}`);
    if (booking.arrivalFrom) arrivalLines.push(`  · ${t("camp.arrival.from", { from: booking.arrivalFrom })}`);
    if (booking.arrivalTime) arrivalLines.push(`  · ${t("camp.arrival.atTime", { time: booking.arrivalTime })}`);
    if (booking.flightNumber) arrivalLines.push(`  · ${t("camp.arrival.flight", { number: booking.flightNumber })}`);
    if (booking.trainNumber) arrivalLines.push(`  · ${t("camp.arrival.train", { number: booking.trainNumber })}`);
    if (booking.busCompany) arrivalLines.push(`  · ${t("camp.arrival.bus", { company: booking.busCompany })}`);
    if (booking.departureTime) arrivalLines.push(`  · ${t("camp.arrival.departure", { time: booking.departureTime })}`);
    if (booking.arrivalNotes) arrivalLines.push(`  · ${t("camp.arrival.notes", { notes: booking.arrivalNotes })}`);
  }

  return (
    <article
      aria-label={t("camp.camp", { number: turno.number })}
      className={`rounded-lg overflow-hidden border bg-[var(--c-surface,#ffffff)] ${
        isNext ? "border-2 border-[var(--c-wwf-green,#007932)]" : "border-[var(--c-border,#cecece)]"
      } ${isPast ? "opacity-75" : ""}`}
    >
      {/* Header strip — camp name + dates + status pill */}
      <div className="flex flex-wrap items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--c-wwf-green,#007932)]">
              {t("camp.dates")}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusTone(status)}`}
            >
              {statusLabel}
            </span>
          </div>
          <h2 className="font-head text-xl md:text-2xl text-ink leading-tight">
            {t("camp.camp", { number: turno.number })}
          </h2>
          <p className="text-sm text-ink-grey tabular-nums">
            {fmtDate(turno.startDate)} → {fmtDate(turno.endDate)}
          </p>
          <p className="text-sm font-semibold text-ink mt-1">{countdown}</p>
        </div>
        <Link
          href={path(`account/bookings/${booking.id}`)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--c-wwf-green,#007932)] hover:underline"
          aria-label={t("camp.openDetails")}
        >
          {t("camp.openDetails")}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>

      {/* Payments sub-section */}
      {!isPast && (
        <div className="px-4 pb-2 border-t border-[var(--c-border,#cecece)] pt-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-ink-grey mb-2 inline-flex items-center gap-1">
            <Wallet size={11} aria-hidden="true" />
            {t("camp.payment.title")}
          </p>
          <div className="space-y-1.5">
            <PaymentRow
              label={t("camp.payment.deposit")}
              ok={depositApproved}
              okLabel={t("camp.payment.depositApproved")}
              pendingLabel={t("camp.payment.depositPending")}
              missingLabel={t("camp.payment.depositMissing")}
              path={path}
              bookingId={booking.id}
              t={t}
            />
            {hasBalanceRequired && (
              <PaymentRow
                label={t("camp.payment.balance", { amount: 190 })}
                ok={balanceApproved || status === "paid" || status === "confirmed" && booking.balancePaid}
                okLabel={t("camp.payment.balancePaid")}
                pendingLabel={t("camp.payment.balanceMissing")}
                missingLabel={t("camp.payment.balanceMissing")}
                path={path}
                bookingId={booking.id}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {/* Arrival sub-section */}
      {arrivalLines.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--c-border,#cecece)]">
          <p className="text-[10px] uppercase tracking-wider font-bold text-ink-grey mb-2 inline-flex items-center gap-1">
            <Plane size={11} aria-hidden="true" />
            {t("camp.arrival.title")}
          </p>
          <div className="text-sm text-ink font-mono whitespace-pre-wrap leading-relaxed">
            {arrivalLines.join("\n").replace(/^✦ /, "")}
          </div>
          <Link
            href={path(`account/bookings/${booking.id}`)}
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[var(--c-wwf-green,#007932)] hover:underline"
          >
            {t("camp.editArrival")}
            <ExternalLink size={11} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Arrival not yet set */}
      {arrivalLines.length === 0 && !isPast && (
        <div className="px-4 py-2 border-t border-[var(--c-border,#cecece)]">
          <p className="text-[10px] uppercase tracking-wider font-bold text-ink-grey mb-2 inline-flex items-center gap-1">
            <AlertTriangle size={11} aria-hidden="true" className="text-[var(--c-ink-red,#ed2b00)]" />
            <span className="text-[var(--c-ink-red,#ed2b00)]">{t("camp.arrival.title")}</span>
          </p>
          <p className="text-sm text-ink-grey">{t("camp.arrival.notSet")}</p>
          <Link
            href={path(`account/bookings/${booking.id}`)}
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[var(--c-ink-red,#ed2b00)] hover:underline"
          >
            {t("camp.editArrival")}
            <ExternalLink size={11} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Receipts sub-section (for users who need to upload a receipt) */}
      {!isPast && status !== "paid" && status !== "cancelled" && (
        <div className="px-4 py-2 border-t border-[var(--c-border,#cecece)] flex flex-wrap items-center gap-2">
          {!depositApproved && (
            <Link
              href={path(`account/bookings/${booking.id}/receipts`)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-[var(--c-wwf-green,#007932)] text-[var(--c-wwf-green,#007932)] hover:bg-[var(--c-wwf-green-pale,#c9e8a0)]/40 font-semibold"
            >
              <Plus size={12} aria-hidden="true" />
              {t("camp.uploadReceipt")}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

function PaymentRow({
  label,
  ok,
  okLabel,
  pendingLabel,
  missingLabel,
  path,
  bookingId,
  t: _t
}: {
  label: string;
  ok: boolean;
  okLabel: string;
  pendingLabel: string;
  missingLabel: string;
  path: (p: string) => string;
  bookingId: string;
  t: T;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-grey text-xs shrink-0">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)] text-[10px] font-bold uppercase tracking-wider">
          <Check size={10} aria-hidden="true" />
          {okLabel}
        </span>
      ) : pendingLabel ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--c-tag-orange-bg,#fef3c7)] text-[#92400e] text-[10px] font-bold uppercase tracking-wider">
          <AlertCircle size={10} aria-hidden="true" />
          {missingLabel}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--c-tag-red-bg,#fee2e2)] text-[var(--c-tag-red-text,#991b1b)] text-[10px] font-bold uppercase tracking-wider">
          <AlertCircle size={10} aria-hidden="true" />
          {missingLabel}
        </span>
      )}
      <Link
        href={path(`account/bookings/${bookingId}/receipts`)}
        className="ml-auto text-xs text-ink-grey hover:text-ink underline-offset-2 hover:underline"
      >
        <ChevronRight size={11} className="inline" aria-hidden="true" />
      </Link>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Quick links
   ────────────────────────────────────────────────────────────────────── */

function QuickLinks({
  t,
  locale: _locale,
  path
}: {
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  void _locale;
  const links = [
    { href: path("packing-list"), label: t("quickLinks.packing"), icon: ListChecks },
    { href: path("about"), label: t("quickLinks.directions"), icon: MapPin },
    { href: path("faq"), label: t("quickLinks.faq"), icon: HelpCircle }
  ];
  return (
    <nav aria-label="Quick links" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className="text-ink-grey hover:text-[var(--c-wwf-green,#007932)] inline-flex items-center gap-1.5"
          >
            <Icon size={14} aria-hidden="true" />
            {l.label}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Account row
   ────────────────────────────────────────────────────────────────────── */

function AccountRow({
  email,
  deviceCount,
  t,
  path
}: {
  email: string;
  deviceCount: number;
  t: T;
  path: (p: string) => string;
}) {
  return (
    <section
      aria-label={t("account.sectionLabel")}
      className="pt-4 mt-2 border-t border-[var(--c-border,#cecece)] text-sm space-y-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-xs text-ink-grey break-all">{email}</span>
        <span className="text-xs text-ink-grey">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-ink-grey">
          <Check size={11} className="text-[var(--c-wwf-green,#007932)]" aria-hidden="true" />
          {t("account.emailVerified")}
        </span>
        <span className="text-xs text-ink-grey">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-ink-grey">
          <Phone size={11} aria-hidden="true" />
          {t("account.deviceCount", { count: deviceCount })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={path("account/profile")} className="text-ink-grey hover:text-ink">
          {t("account.profile")}
        </Link>
        <Link href={path("account/sessions")} className="text-ink-grey hover:text-ink">
          {t("account.manageDevices")}
        </Link>
        <span className="ml-auto">
          <LogoutLink label={t("account.logout")} />
        </span>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Empty state (no bookings yet)
   ────────────────────────────────────────────────────────────────────── */

function EmptyState({
  tEmpty,
  t,
  locale: _locale,
  path
}: {
  tEmpty: T;
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  void _locale;
  void tEmpty;
  return (
    <div className="rounded-lg border border-[var(--c-border,#cecece)] bg-[var(--c-surface,#ffffff)] p-8 text-center space-y-4">
      <CalendarDays size={32} className="mx-auto text-[var(--c-wwf-green,#007932)]" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">{t("emptyState.title")}</h2>
        <p className="text-sm text-ink-grey">{t("emptyState.body")}</p>
      </div>
      <Link
        href={path("dates")}
        className="inline-flex items-center gap-1 px-5 py-2.5 rounded-md bg-[var(--c-wwf-green,#007932)] text-white text-sm font-semibold hover:bg-[var(--c-wwf-green-dark,#005a25)] transition-colors"
      >
        {t("emptyState.cta")}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

/* Silence unused-locals warnings for icons imported for future use */
void Plane; void Train; void Bus; void Ship; void Car; void Wallet2;
