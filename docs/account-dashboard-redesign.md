# /it/account — Volunteer dashboard redesign: research & recommendations

> Research only. No code, no commits. Target page: `/[locale]/account` for the
> WWF Crotone volunteer-camp registration site (IT/EN, magic-link login,
> Next.js 15 App Router + Tailwind).

The goal of this document is to (1) ground the redesign in real-world
references, (2) decide what should actually appear on the dashboard for
someone who just signed up for a nature-conservation camp, (3) sketch a
layout, and (4) flag pitfalls in the current implementation.

---

## 1. Reference examples

Most of the live "donor / member area" UIs (WWF sostenitori, charity:water,
Kiva, Eventbrite, Meetup, AllTrails, GitHub Settings) sit behind auth and
could not be crawled anonymously. The notes below come from a mix of
publicly-visible login pages, marketing/feature pages, and well-documented
UI patterns. Where a reference is a paywalled/auth-walled dashboard, the
description is reconstructed from widely-known product conventions and from
the public marketing pages that describe the same UX.

### 1.1 WWF Italia — `sostenitori.wwf.it`
URL: https://sostenitori.wwf.it/  (login) → behind auth, dashboard not crawlable.

What it tells us:
- WWF Italia does maintain a real supporter area, separate from `wwf.it`
  (same `bluelabs` agency). It uses a username + password (not magic-link)
  and a simple photographic login screen with a single primary "AVANTI"
  CTA. The IA, once inside, includes a "scadenza quota" reminder and
  payment-receipt download — the kind of supporter dashboard the Crotone
  camp project can plausibly mirror.
- Takeaway: keep the supporter area visually and verbally distinct from
  the public site. WWF does this by serving it from a subdomain with its
  own brand bar. For Crotone we can do this with a tighter header and a
  "Sei nell'area personale" breadcrumb, but the same single-CTA clarity
  applies.

### 1.2 charity:water — donor dashboard
URLs tried: `charitywater.org/my-account`, `/account`, `/dashboard` — all 404
(their supporter area requires login). Public site:
https://www.charitywater.org/

What is known from their public materials and Stripe/nonprofit dashboards
in the same space:
- Donor dashboards almost always lead with **"your impact"** — a single
  big number ("$X funded 3 projects, serving N people") above the fold,
  with the next recommended action as a secondary button. Charity:water
  leans into "100% model" messaging; their supporter UX reflects that.
- Two layers: top-of-page **macro stats** (lifetime giving, current
  recurring gift, last project funded) and below the fold **transaction
  history + tax receipts as PDF links**.
- The "what's next" prompt is never more than one — usually "update
  payment method" or "edit monthly amount".
- Lesson for us: replace four peer cards with one **headline card**
  (your registration) and a thin secondary row (logistics, account).

### 1.3 Kiva — lender portfolio
URLs: `kiva.org/my/profile`, `kiva.org/portfolio` — both 406 from our agent
(Kiva gates them).

Known pattern from the public product:
- A lender's home is a **portfolio overview** (total lent, outstanding,
  repaid, in arrears) with a small list of "loans you funded" at the
  bottom. The "active loan" gets a status pill (fundraising / funded /
  repaying / repaid) and a tiny progress bar. Filter chips on top
  ("Active", "Funded", "Ended").
- Lesson for us: a horizontal **status-pill row** ("Da completare",
  "In attesa", "Confermata") is a more useful scanner than four stacked
  cards. Each pill filters the list below.

### 1.4 Eventbrite / Meetup — "My Events"
- Eventbrite: a top-row three-tab switcher ("Upcoming", "Past",
  "Saved"), then a chronological card list with date-on-left,
  event-info-on-right, and a single contextual CTA per card
  ("View ticket", "Get directions", "Request refund"). One CTA per card,
  not three. URL after login: `eventbrite.com/myevents/`.
- Meetup: `meetup.com/find/events/` becomes `meetup.com/{group}/events/`
  for a logged-in user. Their "Settings" area (which we could see
  anonymously) is a long vertical index — the opposite of what we want.
  It is the textbook example of a "settings index anti-pattern" and is
  a warning, not a model. **URL**: https://www.meetup.com/account/.
- Lesson: the dashboard is *content*, the settings are *preferences*. Do
  not mix them on the same page. Settings live at `/account/profile`,
  `/account/sessions`, `/account/delete` — already in our app.

### 1.5 GitHub — Settings → Account overview
- URL: `github.com/settings/admin` (login required).
- Pattern: a **left-rail nav** (Profile, Account, Security, Billing,
  …) and a right-hand main panel. Account overview shows: profile
  completeness, public email, contributions, two-factor status. Each
  setting is a labelled section with a small "Configure" link, not a
  full card with its own giant button.
- Lesson: a left rail of secondary nav is overkill for a project this
  size. The right-hand pattern (labelled sections with one short link
  per section) is exactly what we want, with the nav flat at the top or
  skipped entirely.

### 1.6 Linear — Inbox
URL: https://linear.app/ (marketing screenshots of the in-app view).

- The app launches straight into "Inbox" — a single prioritized feed.
  The left rail (Inbox / My Issues / Views) is short and persistent;
  everything else is one click deep.
- Lesson: the user's home should be a **single prioritized feed**, not
  four equal cards. Cards of equal weight create a "where do I start?"
  problem. We should rank: pending action → upcoming event → secondary
  items.

### 1.7 Notion / Stripe / Vercel — account settings
- All three use the **left-rail nav + right-pane content** pattern, and
  they all put a small **account-status summary** at the very top of the
  account home (e.g. "Your account is on the Free plan, [Upgrade]").
- The summary is exactly the right place to surface "email verified ✓ /
  deposit uploaded ⏳ / admin confirmed ⏳" — a per-row checklist, not a
  separate card.
- Lesson: status checklist belongs at the **top of the home**, not
  inside a card with its own CTA.

### 1.8 Charity/event sector — typical patterns (synthesized)
- Volunteer portal dashboards (GoFundMe Charity, VolunteerMatch,
  Idealist volunteer accounts, Salesforce Nonprofit Success Pack portals)
  almost universally use a **timeline / progress bar** for the
  onboarding-to-event journey. The progress bar doubles as the page's
  primary action: clicking the next uncompleted step takes you where
  you need to go.
- This is the single most important pattern for us: a registration has
  a finite, ordered set of states (email verified → personal data
  filled → €100 deposit receipt uploaded → admin confirmed → camp
  complete). That should be a **horizontal stepper** at the top of the
  page.

### 1.9 AllTrails / GitLab / Linear — list rows with status pills
- "List row, not card" for things the user already understands. Cards
  are for cross-cutting promotions. A list of bookings with a status
  pill, date, location, and a single chevron/arrow link is much denser
  and more scannable than a card grid.

### 1.10 Refactoring UI (Adam Wathan & Steve Schoger) — design tactics
URL: https://refactoringui.com/

Specific chapters relevant here:
- "Don't design too much" — we have 4 cards doing 4 unrelated things.
  Cut to 1 hero + 3 small links.
- "Establish a spacing and sizing system" — the current `.card-body` with
  bottom-stretched buttons is a sizing-system smell.
- "Don't use grey text on colored backgrounds" — the muted
  text-on-muted-background pattern in the placeholder card is exactly
  the anti-example.
- "Don't overlook empty states" — the "Dispositivi" card has zero
  empty-state copy, just `sessionsBody`. The empty state must say
  *why* the list is empty and *what to do*.
- "Use fewer borders" + "Add color with accent borders" — the current
  4-card layout leans entirely on borders. A single primary card with
  an accent (left) border communicates priority better.

### 1.11 Summary of what to copy vs avoid

| From                       | Copy                                          | Avoid                              |
|----------------------------|-----------------------------------------------|------------------------------------|
| WWF sostenitori            | "Sei nell'area personale" framing             | Username/password (we have magic-link) |
| charity:water / Kiva       | One headline "impact" block at top            | Transaction-history emphasis        |
| Eventbrite                 | One CTA per booking, date-on-left             | Tab switcher (overkill)             |
| GitHub Settings            | Status checklist with one link per row        | Left rail (overkill)                |
| Linear                     | Single prioritized feed at top                | Tabs-within-tabs                    |
| Notion / Stripe            | Account-status summary at very top            |                                    |
| Volunteer portals (general)| Horizontal stepper for onboarding             |                                    |
| Refactoring UI             | Accent-border hero, no full-width buttons     | 4-card grid + stretched buttons    |
| Meetup Settings (caution)  |                                               | Vertical settings index            |

---

## 2. What should be on the dashboard for a Crotone volunteer

The volunteer has just done one of three things:
1. Just submitted the booking form (most common — they're a "fresh" user).
2. Logged in to upload their €100 deposit receipt.
3. Logged in the week before camp to check logistics.

A useful dashboard serves all three without redesigning. The right model
is a **single ordered feed of "things about your camp"** with the
incomplete steps pushed to the top.

### 2.1 Above the fold (no scrolling)

1. **Welcome line** — "Ciao, {firstName} 👋" (no emoji if your design
   system forbids it; this is opinionated). Sub-line: the email
   address + a `30d` / `Sessione di oggi` tag so the user knows they're
   trusted and on which device.

2. **Onboarding stepper** (only shown if the registration is not yet
   fully confirmed). Five steps, with a `✓` / current-step / grey-future
   treatment:
   ```
   Email verificata ✓ → Dati personali ✓ → Iscrizione inviata ✓ →
   Ricevuta deposito caricata ⏳ (cliccami) → Conferma amministrazione ⏳
   ```
   The current step is a **primary button** (e.g. "Carica la ricevuta
   del deposito"). Already-done steps are green check + short label.
   Future steps are grey. This is the page's *single* primary CTA.

3. **Next camp card** — if they have at least one booking, the next
   upcoming turn is shown as a compact card with:
   - Camp name + location (Le Dune di Crotone / Oasi…)
   - Date range, with a **countdown** ("Tra 23 giorni" / "Domani!" /
     "In corso — giorno 2 di 7")
   - Status pill (Confermata / In attesa / Lista d'attesa)
   - One link: "Vedi dettagli iscrizione" → `/account/bookings/{id}` or
     the equivalent.

   If the next camp is **> 30 days away**, the countdown is enough. If
   **< 7 days**, expand inline to show:
   - "Dove arrivare" — short address with a "Apri in Maps" link
   - "Cosa portare" — link to `/packing-list` (this page already
     exists in the repo)
   - "Orari" — check-in / briefing time
   - "Contatti referenti" — phone + WhatsApp

   If they have **no bookings yet**, replace the card with a non-empty
   empty state: "Non hai ancora un'iscrizione. [Scopri i turni
   disponibili]" → `/dates`.

4. **Deposit / payment summary** — a thin row, not a card:
   - "Deposito cauzionale: €100 — Ricevuta caricata il 3 ago 2026"
     with a "Sostituisci ricevuta" link (secondary text, not button).
   - Or, if not uploaded: "Deposito cauzionale: €100 — Ricevuta non
     ancora caricata" with a "Carica ora" inline link.

### 2.2 Below the fold

5. **All bookings** — a list (not a grid) of every `Iscrizione` for the
   user, ordered by `turno.startDate` descending. Each row: turn name,
   date, status pill, "Vedi" chevron. Max 3 rows visible + a "Vedi
   tutte ({n})" link to `/account/bookings` if more.

   Why a list and not a card: the user already knows what their
   bookings are; a list is scannable. Cards are for things the user
   hasn't seen yet.

6. **Logistics quick links** (3 small icon links, inline):
   - "Lista cose da portare" → `/packing-list`
   - "Come arrivare" → `/about` (or dedicated logistics page)
   - "FAQ" → `/faq`

7. **Account row** (single line, *not* a card):
   - Avatar / initials + name
   - Email (verified ✓ or "Verifica email" link)
   - "Modifica profilo" → `/account/profile`
   - "Dispositivi connessi" → `/account/sessions` (see §2.3)
   - "Esci" (text link styled in red, not a primary button) — placed
     **last** so users don't click it by accident.

### 2.3 Devices / sessions — what to actually show

The current "Dispositivi" card is empty placeholder text. The data
already exists (`DeviceSession` model in `prisma/schema.prisma`). Show:

- A short sentence: "1 altro dispositivo ha effettuato l'accesso al
  tuo account" (or "Sei connesso solo da questo dispositivo" if alone).
- Each device as a one-line row: device name + browser + city + last
  active + "Disconnetti" link.
- "Disconnetti tutti gli altri" link if more than one.

This belongs on the dashboard *only as a status note*, not as a card.
Full device management lives at `/account/sessions`.

### 2.4 Things deliberately NOT on the dashboard

- "Le mie iscrizioni" as a peer of the registration status. The
  bookings list is reachable from the bookings card. Two items that
  point to the same place is the second anti-pattern from the brief.
- A separate "La mia iscrizione" card. The `/mio-iscrizione` route is
  described as the OLD single-booking page; the new design replaces it
  with the "next camp" card in §2.1. Either delete `/mio-iscrizione`
  or redirect it to `/account/bookings`.
- Empty placeholder cards. If a section has no data and no value, do
  not render a card for it. The "Dispositivi" empty state is a one-line
  status note, not a card.

---

## 3. Recommended layout sketch

ASCII (mobile-first, max-width ~640px; on `md:` it becomes the two-column
"hero + side" version). Italian copy.

```
┌──────────────────────────────────────────────────────────────┐
│  Sei nell'area personale                                     │  ← breadcrumb / context
│                                                              │
│  Ciao, Marco 👋                                              │  ← h1
│  marco.rossi@example.com                  [Sessione di oggi] │  ← sub-line
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ●  ① Email verificata               3 ago 2026          │ │  ← stepper
│ │ ●  ② Dati personali completi        3 ago 2026          │ │
│ │ ●  ③ Iscrizione inviata             3 ago 2026          │ │
│ │ ▶  ④ Carica la ricevuta del deposito  [ Carica ora ]    │ │  ← current, primary CTA
│ │ ○  ⑤ Conferma dei coordinatori      In attesa           │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  Le Dune di Crotone                                     │ │  ← next-camp card
│ │  📅 4–10 set 2026   ⏳ Tra 23 giorni                    │ │
│ │  Stato: ● In attesa di conferma                         │ │
│ │  Vedi dettagli iscrizione →                             │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Deposito cauzionale: €100 · Ricevuta non ancora caricata.    │  ← inline status
│                                       [ Carica ricevuta ]     │
│                                                              │
│ Le tue iscrizioni                                            │  ← section header
│  • 4–10 set 2026 · Le Dune di Crotone    In attesa →         │
│  • 18–24 lug 2026 · Oasi di Policoro    Completata →         │
│  Vedi tutte (2) →                                            │
│                                                              │
│ Link rapidi: [Cose da portare] [Come arrivare] [FAQ]         │
│                                                              │
│ ───────────────────────────────────────────────────────────  │
│  Account                                                    │
│  marco.rossi@example.com · email verificata ✓                │
│  Modifica profilo · Dispositivi connessi (1) · Esci          │  ← text links, red
└──────────────────────────────────────────────────────────────┘
```

### Desktop (`md:` and up)

```
┌──────────────────────────┬───────────────────────────────────┐
│ Ciao, Marco 👋           │  ● ① Email verificata   ✓          │
│ marco.rossi@example.com  │  ● ② Dati personali    ✓          │
│ [Sessione di oggi]       │  ▶ ④ Carica ricevuta   [Carica]   │
│                          │  ○ ⑤ Conferma admin    ⏳          │
│ ┌──────────────────────┐ ├───────────────────────────────────┤
│ │  Le Dune di Crotone  │ │  Le tue iscrizioni                │
│ │  4–10 set 2026       │ │  • 4–10 set · Le Dune    →        │
│ │  Tra 23 giorni       │ │  • 18–24 lug · Policoro →         │
│ │  Stato: In attesa    │ │  Vedi tutte (2) →                 │
│ │  Vedi dettagli →     │ │                                  │
│ └──────────────────────┘ │  Deposito: €100 · non caricato   │
│                          │  [Carica ricevuta]                │
│  Link rapidi             │                                  │
│  [Cose] [Mappa] [FAQ]    │  Account · Profilo · Esci        │
└──────────────────────────┴───────────────────────────────────┘
```

### Empty states (no booking yet)

Replace the next-camp card with:

```
┌──────────────────────────────────────────────────────────┐
│  🐢  Non hai ancora un'iscrizione                        │
│  Scopri i turni disponibili per il campo di volontariato. │
│  [ Vedi i turni ]                                        │
└──────────────────────────────────────────────────────────┘
```

Replace the stepper with a single line: "Completa la registrazione
per iniziare."

### Status pill vocabulary (use everywhere)

| Italian              | Tone                  | Use                          |
|----------------------|-----------------------|------------------------------|
| `Confermata`         | green, ✓              | Admin has approved           |
| `In attesa`          | amber, ⏳              | Awaiting admin               |
| `Ricevuta mancante`  | amber, ⚠               | Needs the deposit receipt    |
| `Da completare`      | red, !                | Incomplete profile           |
| `Lista d'attesa`     | grey, …                | On the waitlist              |
| `Completata`         | green, ✓ (filled)     | Camp finished, attended      |

Pill = short label + small icon, inline with text, never used as a
button. (Buttons inside pills are a refactoring-UI "labels are a last
resort" anti-pattern.)

---

## 4. Pitfalls observed in the current page

These are the specific issues visible in `src/components/features/AccountHomeClient.tsx`
and what the redesign should fix.

1. **Giant buttons that stretch to fill the card width** — every card
   ends in a `<Link className="btn btn-primary">` (lines 94, 103, 120).
   On mobile, a 100%-width button next to a card title is the classic
   "the only thing you can touch is the whole card" mistake. The fix
   is to use `inline-flex` width buttons or, better, replace buttons
   with right-aligned text links ("Vedi dettagli →").

2. **Two cards pointing to the same data** — "Le mie iscrizioni" →
   `/account/bookings` and "La mia iscrizione" → `/mio-iscrizione`
   (lines 90–98 and 100–107) both lead to a list of the user's
   bookings. The new design keeps the bookings list as a row on the
   dashboard and as the destination of the "Vedi tutte" link. The
   old `/mio-iscrizione` route should be either deleted or
   `redirect()`-ed to `/account/bookings`.

3. **Empty placeholder card** — the "Dispositivi" card
   (lines 109–114) has a title, a body string, and no action, no
   content, and no empty-state design. The new design moves devices
   into a one-line status note and pushes full management to
   `/account/sessions` (which already exists in the repo).

4. **Tiny default-styled logout button** (lines 126–137). It's a
   primary button on a flex row next to an error span. Logout should
   be the *least* visually prominent action on the page, not a primary
   button. Use a small text link in the account row.

5. **Loading state leaks out of the card** — the busy state sets a
   full-button spinner (line 133) and the row uses an `error` span
   inline. The new design's single primary CTA (the stepper's current
   step) should own all the busy state; everything else should be
   navigation.

6. **No session/device info shown** — the page knows
   `session.persistent` (line 38) and the email (line 37) but only
   shows the email. The new design uses both, plus a one-line
   "connesso anche da 1 altro dispositivo" note.

7. **No count of bookings, no status, no dates** — the dashboard tells
   the user *nothing* about their actual situation. It is purely a
   menu. The new design treats the dashboard as a status page, not a
   menu: "where you are" first, "where to go next" second, "what to
   manage" third.

8. **`max-w-2xl` and a single column** is correct for a small site,
   but on `md+` a 2-column hero/side layout (as in §3) shows more
   information above the fold. The current `max-w-2xl` is fine to keep
   as the outer container; the column split lives inside.

9. **Logout is a `POST` with no prefetch** — the new design should
   use a Next.js server action or `router.replace` after the fetch so
   the `/account` route is `revalidatePath()`'d on the way out (no
   stale welcome header). The current `router.refresh()` on
   `AccountHomeClient.tsx:69` is correct, but the redirect to
   `/account/login` will flash the old page if the network is slow
   because the fetch is awaited before the redirect. Consider
   optimistic `router.replace` plus a toast on error.

10. **No skeleton/loading state on the page itself** —
    `src/app/[locale]/loading.tsx` exists but the dashboard does not
    use it; the new design should keep the page a server component
    and let `AccountHomeClient` be a small island only for the stepper
    "Carica ora" action and the logout text link. Most of the
    dashboard can be SSR'd.

---

## 5. Suggested component split (research notes, not code)

For the engineering follow-up:

- `AccountHomeClient.tsx` becomes a thin orchestrator. The four cards
  disappear; the page becomes a vertical composition of:
  - `<WelcomeHeader email persistent firstName />` (server, no state)
  - `<OnboardingStepper steps currentStep />` (server, fetches
    Iscrizione + Receipt + Payment + User.emailVerified)
  - `<NextCampCard booking />` (server, fetches next Turno with
    IscrizioneTurno)
  - `<BookingsList bookings max=3 />` (server)
  - `<AccountRow email verified devices />` (mostly server, the "Esci"
    text link is the only client island along with the stepper's
    primary CTA)
- The bookings list is the source of truth for both the
  "next-camp card" and the "all bookings" row — pass the same query
  result into both.
- The deposit-receipt CTA should be a `<Link>` to
  `/account/bookings/{id}` (where the existing `ReceiptUploader`
  already lives), not a new uploader on the dashboard. Prefetch is
  free with `next/link`.
- Keep all copy in `src/i18n/messages/{it,en}.json` under a new
  `Account.dashboardV2` key so the old keys can stay for one release
  in case any tests/links still reference them.

---

## 6. Out of scope (deliberately not recommended)

- A full left-rail nav like GitHub/Notion — overkill for the surface
  area.
- A dark mode pass — the repo already supports it via CSS variables,
  so any new components just need to use the existing tokens.
- A redesign of `/mio-iscrizione` — recommend deletion or
  redirect-to-bookings instead. The "next camp" card already
  contains everything that page had.
- A native-app-style onboarding wizard — the stepper on the dashboard
  is enough; making them click into a wizard to upload the receipt
  adds a round trip.

---

## Sources

- https://www.wwf.it/ — Italian WWF public site
- https://sostenitori.wwf.it/ — WWF supporter area (login, not
  dashboard)
- https://www.wwf.it/cosa-puoi-fare-tu/partecipa/campi-di-volontariato/
  — the actual Crotone camp program (confirms use-case)
- https://linear.app/ — Linear marketing site, used to confirm the
  "single prioritized feed + short left rail" pattern
- https://www.meetup.com/account/ — Meetup settings index, used as an
  anti-example (long vertical index)
- https://refactoringui.com/ — design tactics cited in §1.10
- https://github.com/settings/admin — login-gated, included as a
  reference only for the labelled-section layout pattern

Internal repo references:
- `src/app/[locale]/account/page.tsx` — current page
- `src/components/features/AccountHomeClient.tsx` — current client
- `prisma/schema.prisma` — confirms the data we already have:
  `Iscrizione`, `Receipt`, `Payment`, `Turno`, `IscrizioneTurno`,
  `DeviceSession`, `Notification` are all model-level available
- `src/components/features/ReceiptUploader.tsx`,
  `BookingDetailClient.tsx`, `MyRegistrationClient.tsx`,
  `StatusOverviewClient.tsx` — existing components that the new
  dashboard can compose, not rebuild
- `src/app/[locale]/loading.tsx` — already a server-rendered loading
  boundary
