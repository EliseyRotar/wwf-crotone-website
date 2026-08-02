/**
 * Phase 2: Resolve all Iscrizione rows that "belong to" the current
 * volunteer. The volunteer has no separate User account — they are
 * identified by their Iscrizione row. Multiple rows can exist under
 * the same email (e.g. someone who booked Turno 1 and Turno 3
 * separately). The session's `iscrizioneId` is the row that was used
 * to mint the cookie, but we consider ALL non-deleted Iscrizione rows
 * with the same email as accessible to this user.
 *
 * This function is the single source of truth for the
 * "show all my bookings" list. Both the page and the API route use it.
 */

import { prisma } from "@/lib/prisma";

/**
 * Fetch the list of all bookings (Iscrizione rows) the current
 * volunteer can manage. Returns at least the row whose id is
 * `primaryIscrizioneId` even if the email differs (defensive — should
 * not happen in practice but ensures the user always sees the booking
 * they signed in with).
 */
export async function findBookingsForVolunteer(opts: {
  iscrizioneId: string;
  email: string;
}) {
  // Defensive: confirm the primary row exists and is not soft-deleted.
  // We always include it even if no other rows match the email.
  const primary = await prisma.iscrizione.findFirst({
    where: { id: opts.iscrizioneId, deletedAt: null },
    select: { id: true, email: true }
  });

  const email = (primary?.email ?? opts.email).toLowerCase();

  const rows = await prisma.iscrizione.findMany({
    where: {
      deletedAt: null,
      OR: [
        { email },
        { id: opts.iscrizioneId }
      ]
    },
    include: {
      turno: { select: { id: true, number: true, startDate: true, endDate: true } },
      iscrizioneTurni: {
        include: { turno: { select: { id: true, number: true, startDate: true, endDate: true } } }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  // Dedupe by id (in case both clauses match)
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
