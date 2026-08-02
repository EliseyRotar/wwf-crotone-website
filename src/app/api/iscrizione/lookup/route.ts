import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { verifyLookupToken } from "@/lib/lookupToken";

export const dynamic = "force-dynamic";

const LOOKUP_COOKIE = "wwf_lookup";

/**
 * Authenticated lookup of a volunteer's own registrations.
 *
 * Two authorised callers:
 *  1. WWF staff with the LOOKUP_ADMIN_TOKEN env var, sent as the
 *     `x-admin-token` header (used by background scripts / manual lookups).
 *  2. The volunteer themselves, via the HMAC-signed `lookupToken` cookie
 *     issued at registration completion (see src/lib/lookupToken.ts).
 *
 * Unauthenticated callers receive 200 OK with an empty array — we never
 * leak "exists / doesn't exist" timing.
 */
export async function GET(req: Request) {
  const adminToken = process.env.LOOKUP_ADMIN_TOKEN;
  const headerToken = req.headers.get("x-admin-token");
  const isAdmin = !!(adminToken && headerToken && headerToken === adminToken);

  let iscrizioneId: string | null = null;
  if (!isAdmin) {
    const store = await cookies();
    const cookie = store.get(LOOKUP_COOKIE)?.value;
    if (!cookie) {
      // Always 200 + empty — no enumeration via timing or 404.
      return NextResponse.json({ ok: true, iscrizioni: [] });
    }
    iscrizioneId = verifyLookupToken(cookie); // null if invalid/expired
    if (!iscrizioneId) {
      return NextResponse.json({ ok: true, iscrizioni: [] });
    }
  }

  // Single, generous cap shared by both code paths.
  if (!(await rateLimit(`lookup:${clientKey(req)}`, 10, 900_000))) {
    return NextResponse.json({ ok: true, iscrizioni: [] });
  }

  const iscrizioni = await prisma.iscrizione.findMany({
    where: isAdmin
      ? { status: { notIn: ["cancelled"] as string[] } }
      : { id: iscrizioneId as string, status: { notIn: ["cancelled"] as string[] } },
    select: {
      id: true,
      status: true,
      feePaid: true,
      balancePaid: true,
      turno: { select: { number: true, startDate: true, endDate: true } }
    },
    orderBy: { turno: { number: "asc" } }
  });

  // Strip PII for the (own-registration) volunteer path. Staff bypass
  // already needs to use the admin panel — this endpoint only exposes the
  // minimum needed for the "my registration" UI.
  return NextResponse.json({
    ok: true,
    iscrizioni: iscrizioni.map((i) => ({
      turnoNumber: i.turno.number,
      turnoStart: i.turno.startDate.toISOString(),
      turnoEnd: i.turno.endDate.toISOString(),
      status: i.status,
      feePaid: i.feePaid,
      balancePaid: i.balancePaid
    }))
  });
}
