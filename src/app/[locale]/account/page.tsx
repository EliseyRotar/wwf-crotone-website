import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAccountSession } from "@/lib/accountSession";
import { findBookingsForVolunteer } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";
import { DEVICE_COOKIE_NAME, verifyDeviceCookie } from "@/lib/deviceSession";
import {
  CalendarDays,
  Check,
  Clock,
  ListChecks,
  MapPin,
  ChevronRight,
  AlertCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import LogoutLink from "@/components/features/LogoutLink";

export const dynamic = "force-dynamic";

type Booking = Awaited<ReturnType<typeof findBookingsForVolunteer>>[number];

/**
 * /[locale]/account — the personal area home.
 *
 * Server component. Reads the session, resolves all bookings for the
 * volunteer, and renders a single prioritized feed:
 *
 *   1. Welcome line + session/device chip
 *   2. Onboarding status (thin progress bar) — only if not complete
 *   3. Next-camp card with status pill + countdown + CTA
 *   4. Payment row (deposit + balance state)
 *   5. All bookings list (rows, max 3 + see-all)
 *   6. Quick links (text-only)
 *   7. Account row (profile / devices / logout — all text-only)
 *
 * Two-state design:
 *   - Has bookings  → everything above is rendered.
 *   - No bookings    → only welcome + a single empty-state card.
 *
 * Logout is the only client island (LogoutLink) so the page stays
 * SSR'd and instant to load.
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

  // ─── Fetch everything in parallel ───
  const [bookings, deviceCount] = await Promise.all([
    findBookingsForVolunteer({ iscrizioneId: session.iscrizioneId, email: session.email }),
    prisma.deviceSession.count({
      where: { userId: session.iscrizioneId, expiresAt: { gt: new Date() } }
    })
  ]);

  // Empty state — no bookings at all
  if (bookings.length === 0) {
    return (
      <main className="container section max-w-3xl space-y-6">
        <header>
          <p className="text-[11px] uppercase tracking-wider text-ink-grey mb-1">
            {t("areaLabel")}
          </p>
          <h1 className="text-2xl md:text-3xl mb-2">{t("welcome", { name: session.firstName })}</h1>
          <p className="text-sm text-ink-grey">{session.email}</p>
        </header>
        <EmptyState tEmpty={tBookings} locale={locale} path={path} />
      </main>
    );
  }

  // ─── Sort bookings: next upcoming first, then by createdAt desc ───
  const now = new Date();
  const withMeta = bookings.map((b) => ({
    ...b,
    isUpcoming: b.turno.endDate.getTime() >= now.getTime(),
    isPast: b.turno.endDate.getTime() < now.getTime()
  }));
  const upcoming = withMeta.filter((b) => b.isUpcoming).sort(
    (a, b) => a.turno.startDate.getTime() - b.turno.startDate.getTime()
  );
  const past = withMeta.filter((b) => b.isPast).sort(
    (a, b) => b.turno.startDate.getTime() - a.turno.startDate.getTime()
  );
  const sortedBookings = [...upcoming, ...past];

  // The "next" camp card is the earliest upcoming booking; if no upcoming,
  // fall back to the most recent past one (completed state).
  const nextCamp = upcoming[0] ?? past[0];

  // Onboarding progress — 5 steps. A step is "done" if its condition is true.
  const onboarding = computeOnboarding(nextCamp, t);
  const allDone = onboarding.doneCount === onboarding.totalSteps;

  // Days-to-go for the next camp
  const daysToGo = nextCamp
    ? Math.max(0, Math.ceil((nextCamp.turno.startDate.getTime() - now.getTime()) / 86_400_000))
    : null;

  return (
    <main className="container section max-w-3xl space-y-6">
      {/* ─── Welcome + session chip ─── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-grey mb-1">
            {t("areaLabel")}
          </p>
          <h1 className="text-2xl md:text-3xl mb-1">
            {t("welcomeWithEmoji", { name: session.firstName })}
          </h1>
          <p className="text-sm text-ink-grey">{session.email}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {session.persistent ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)] font-semibold">
              <Clock size={12} aria-hidden="true" />
              {t("session30d")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--c-tag-grey-bg,#cecece)] text-[var(--c-tag-grey-text,#262626)] font-semibold">
              <Clock size={12} aria-hidden="true" />
              {t("sessionToday")}
            </span>
          )}
        </div>
      </header>

      {/* ─── Onboarding stepper (thin progress bar) ─── */}
      {!allDone && (
        <OnboardingBar onboarding={onboarding} t={t} locale={locale} path={path} />
      )}

      {/* ─── Next camp card (accent-bordered) ─── */}
      {nextCamp && (
        <NextCampCard
          booking={nextCamp}
          daysToGo={daysToGo}
          t={t}
          locale={locale}
          path={path}
        />
      )}

      {/* ─── All bookings (rows, max 3) ─── */}
      <BookingsList
        bookings={sortedBookings.slice(0, 3)}
        totalCount={sortedBookings.length}
        t={t}
        tBookings={tBookings}
        locale={locale}
        path={path}
      />

      {/* ─── Quick links (text only) ─── */}
      <QuickLinks t={t} locale={locale} path={path} />

      {/* ─── Account row (text only) ─── */}
      <AccountRow
        email={session.email}
        deviceCount={deviceCount}
        t={t}
        locale={locale}
        path={path}
      />
    </main>
  );
}

/* ────────────────────────── helpers ────────────────────────── */

type OnboardingResult = {
  totalSteps: number;
  doneCount: number;
  steps: { key: string; done: boolean; label: string; cta?: { label: string; href: string } }[];
  /** Convenience flag: is everything done? */
  allDone: boolean;
  done: boolean;
};

function computeOnboarding(b: Booking, t: T): OnboardingResult {
  // Step 1: email verified — always true (we couldn't be here without a verified email session)
  // Step 2: personal data filled — true (the Iscrizione row has all required fields by construction)
  // Step 3: booking submitted — true
  // Step 4: deposit receipt uploaded — true when feePaid or depositReceiptUploadedAt
  // Step 5: admin confirmed — true when status === "confirmed" or "paid"
  const stepLabels = {
    emailVerified: t("onboarding.steps.emailVerified"),
    dataFilled: t("onboarding.steps.dataFilled"),
    submitted: t("onboarding.steps.submitted"),
    receiptUploaded: t("onboarding.steps.receiptUploaded"),
    adminConfirmed: t("onboarding.steps.adminConfirmed")
  };

  const receiptUploaded = b.feePaid || !!b.depositReceiptUploadedAt;
  const adminConfirmed = b.status === "confirmed" || b.status === "paid";

  const receiptHref = `/it/account/bookings/${b.id}/receipts`;
  const viewHref = `/it/account/bookings/${b.id}`;

  const steps = [
    { key: "emailVerified", done: true, label: stepLabels.emailVerified },
    { key: "dataFilled", done: true, label: stepLabels.dataFilled },
    { key: "submitted", done: true, label: stepLabels.submitted },
    {
      key: "receiptUploaded",
      done: receiptUploaded,
      label: stepLabels.receiptUploaded,
      cta: receiptUploaded
        ? undefined
        : { label: t("onboarding.uploadReceiptCta"), href: receiptHref }
    },
    {
      key: "adminConfirmed",
      done: adminConfirmed,
      label: stepLabels.adminConfirmed,
      cta: !adminConfirmed && receiptUploaded
        ? undefined
        : adminConfirmed
        ? undefined
        : { label: t("onboarding.viewBookingCta"), href: viewHref }
    }
  ];

  return {
    totalSteps: steps.length,
    doneCount: steps.filter((s) => s.done).length,
    steps,
    allDone: steps.every((s) => s.done),
    done: false // filled below
  };
}

/* ─── typed translation wrapper (avoids TS noise) ───────────── */
type T = Awaited<ReturnType<typeof getTranslations>>;

/* ─── Onboarding progress bar ─────────────────────────────── */

function OnboardingBar({
  onboarding,
  t,
  locale,
  path
}: {
  onboarding: OnboardingResult;
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  const pct = Math.round((onboarding.doneCount / onboarding.totalSteps) * 100);
  // Find the first not-done step to surface its CTA
  const current = onboarding.steps.find((s) => !s.done);

  return (
    <section
      aria-label={t("onboarding.label")}
      className="rounded-lg border border-ink-line bg-[var(--c-sand,#f6f2ed)] px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-grey">
          <ListChecks size={14} aria-hidden="true" />
          {t("onboarding.label")} · {t("onboarding.of", {
            done: onboarding.doneCount,
            total: onboarding.totalSteps
          })}
        </div>
        <div className="text-xs text-ink-grey tabular-nums">{pct}%</div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--c-border,#cecece)] overflow-hidden">
        <div
          className="h-full bg-[var(--c-wwf-green,#007932)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {onboarding.steps.map((s) => (
          <li
            key={s.key}
            className={`inline-flex items-center gap-1 ${
              s.done ? "text-ink-grey line-through" : "text-ink"
            }`}
          >
            {s.done ? (
              <Check size={11} className="text-[var(--c-wwf-green,#007932)]" aria-hidden="true" />
            ) : (
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--c-wwf-green,#007932)]" />
            )}
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      {current?.cta && (
        <div className="mt-3">
          <Link
            href={current.cta.href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--c-wwf-green,#007932)] hover:underline"
          >
            <Sparkles size={14} aria-hidden="true" />
            {current.cta.label}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

/* ─── Next-camp card ──────────────────────────────────────── */

function NextCampCard({
  booking,
  daysToGo,
  t,
  locale,
  path
}: {
  booking: Booking;
  daysToGo: number | null;
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  const { turno, status } = booking;
  const isPast = turno.endDate.getTime() < Date.now();
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  const dateRange = `${fmtDate(turno.startDate)} → ${fmtDate(turno.endDate)}`;

  const countdown =
    isPast
      ? t("nextCamp.ended")
      : daysToGo === 0
      ? t("nextCamp.today")
      : daysToGo === 1
      ? t("nextCamp.tomorrow")
      : t("nextCamp.daysToGo", { days: daysToGo ?? 0 });

  const statusKey = status as keyof typeof statusKeyMap;
  const statusLabel = t(`nextCamp.status.${statusKeyMap[statusKey] ?? "pending"}`);

  return (
    <section
      aria-label={t("nextCamp.sectionLabel")}
      className="rounded-lg border-2 border-[var(--c-wwf-green,#007932)] bg-[var(--c-sand-cream,#faf7f1)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[var(--c-wwf-green,#007932)] font-bold mb-1">
            {t("nextCamp.sectionLabel")}
          </p>
          <h2 className="text-xl md:text-2xl font-semibold text-ink leading-tight">
            {path("dates").includes("dates") ? `Campo ${turno.number}` : `Campo ${turno.number}`}
          </h2>
          <p className="mt-1 text-sm text-ink-grey tabular-nums">{dateRange}</p>
          <p className="mt-2 text-sm font-semibold text-ink">{countdown}</p>
        </div>
        <StatusPill status={status} locale={locale} t={t} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={path(`account/bookings/${booking.id}`)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--c-wwf-green,#007932)] hover:underline"
        >
          {t("nextCamp.viewDetails")}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
        <Link
          href={path(`packing-list`)}
          className="inline-flex items-center gap-1 text-sm text-ink-grey hover:text-ink"
        >
          <ListChecks size={14} aria-hidden="true" />
          {t("quickLinks.packing")}
        </Link>
      </div>
    </section>
  );
}

const statusKeyMap: Record<string, string> = {
  pending: "pending",
  email_verified: "email_verified",
  receipt_uploaded: "receipt_uploaded",
  confirmed: "confirmed",
  paid: "paid",
  waitlist: "waitlist",
  cancelled: "cancelled"
};

function StatusPill({
  status,
  t
}: {
  status: string;
  locale: string;
  t: T;
}) {
  const map: Record<string, { className: string; dot: string }> = {
    pending: { className: "bg-[var(--c-tag-orange-bg,#f5d200)] text-[var(--c-tag-orange-text,#101010)]", dot: "bg-[var(--c-wwf-orange,#eb9c4b)]" },
    email_verified: { className: "bg-[var(--c-tag-orange-bg,#f5d200)] text-[var(--c-tag-orange-text,#101010)]", dot: "bg-[var(--c-wwf-orange,#eb9c4b)]" },
    receipt_uploaded: { className: "bg-[var(--c-tag-orange-bg,#f5d200)] text-[var(--c-tag-orange-text,#101010)]", dot: "bg-[var(--c-wwf-orange,#eb9c4b)]" },
    confirmed: { className: "bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)]", dot: "bg-[var(--c-wwf-green,#007932)]" },
    paid: { className: "bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)]", dot: "bg-[var(--c-wwf-green,#007932)]" },
    waitlist: { className: "bg-[var(--c-tag-grey-bg,#cecece)] text-[var(--c-tag-grey-text,#262626)]", dot: "bg-[var(--c-ink-grey,#707070)]" },
    cancelled: { className: "bg-[var(--c-tag-red-bg,#ffe0d6)] text-[var(--c-tag-red-text,#ed2b00)]", dot: "bg-[var(--c-ink-red,#ed2b00)]" }
  };
  const style = map[status] ?? map.pending;
  const label = t(`nextCamp.status.${statusKeyMap[status] ?? "pending"}`);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${style.className}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

/* ─── Bookings list (compact rows, max 3) ──────────────────── */

function BookingsList({
  bookings,
  totalCount,
  t,
  tBookings,
  locale,
  path
}: {
  bookings: Booking[];
  totalCount: number;
  t: T;
  tBookings: T;
  locale: string;
  path: (p: string) => string;
}) {
  const fmtShort = (d: Date) =>
    d.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  return (
    <section aria-label={t("bookings.sectionLabel")} className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-ink-grey">
        {t("bookings.sectionLabel")}
      </h2>
      <ul className="divide-y divide-[var(--c-border,#cecece)] rounded-lg border border-[var(--c-border,#cecece)] overflow-hidden bg-[var(--c-surface,#ffffff)]">
        {bookings.map((b) => (
          <li key={b.id}>
            <Link
              href={path(`account/bookings/${b.id}`)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--c-sand,#f6f2ed)] transition-colors"
            >
              <span className="text-xs font-bold text-[var(--c-wwf-green,#007932)] tabular-nums w-12 shrink-0">
                C{b.turno.number}
              </span>
              <span className="text-sm tabular-nums text-ink-grey shrink-0 hidden sm:inline">
                {fmtShort(b.turno.startDate)}
              </span>
              <span className="text-sm text-ink truncate flex-1">
                {fmtShort(b.turno.startDate)} → {fmtShort(b.turno.endDate)}
              </span>
              <StatusPill status={b.status} locale={locale} t={t} />
              <ChevronRight size={14} className="text-ink-grey shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {totalCount > 3 && (
        <Link
          href={path("account/bookings")}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--c-wwf-green,#007932)] hover:underline"
        >
          {t("bookings.viewAll", { count: totalCount })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

/* ─── Quick links (text only) ────────────────────────────────── */

function QuickLinks({
  t,
  locale,
  path
}: {
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  const links = [
    { href: path("packing-list"), label: t("quickLinks.packing") },
    { href: path("about"), label: t("quickLinks.directions") },
    { href: path("faq"), label: t("quickLinks.faq") }
  ];
  return (
    <nav aria-label="Quick links" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="text-ink-grey hover:text-[var(--c-wwf-green,#007932)] inline-flex items-center gap-1"
        >
          {l.label}
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

/* ─── Account row (text-only, last, subtle) ─────────────────── */

function AccountRow({
  email,
  deviceCount,
  t,
  locale,
  path
}: {
  email: string;
  deviceCount: number;
  t: T;
  locale: string;
  path: (p: string) => string;
}) {
  return (
    <section
      aria-label={t("account.sectionLabel")}
      className="pt-4 mt-2 border-t border-[var(--c-border,#cecece)] text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-xs text-ink-grey">{email}</span>
        <span className="text-xs text-ink-grey">·</span>
        <span className="text-xs text-ink-grey">
          {t("account.emailVerified")}
        </span>
        <span className="text-xs text-ink-grey">·</span>
        <span className="text-xs text-ink-grey">
          {deviceCount} {deviceCount === 1 ? "dispositivo" : "dispositivi"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
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

/* ─── Empty state (no bookings) ─────────────────────────────── */

function EmptyState({
  tEmpty,
  locale,
  path
}: {
  tEmpty: T;
  locale: string;
  path: (p: string) => string;
}) {
  return (
    <div className="rounded-lg border border-[var(--c-border,#cecece)] bg-[var(--c-surface,#ffffff)] p-8 text-center">
      <CalendarDays size={32} className="mx-auto mb-3 text-[var(--c-wwf-green,#007932)]" aria-hidden="true" />
      <p className="text-sm text-ink-grey">{tEmpty("noBookings")}</p>
      <Link
        href={path("dates")}
        className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-md bg-[var(--c-wwf-green,#007932)] text-white text-sm font-semibold hover:bg-[var(--c-wwf-green-dark,#005a25)] transition-colors"
      >
        Scopri i turni disponibili
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}