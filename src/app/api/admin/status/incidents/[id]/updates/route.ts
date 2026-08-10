/**
 * POST /api/admin/status/incidents/[id]/updates — append an update to an incident timeline.
 *
 * When the operator types "We've identified the root cause" in the admin
 * UI, this is where it lands. Replies are localized (it + en) so the
 * public page can pick the right language.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadmin();
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-inc-update:${clientKey(req)}`, 30, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { id } = await params;
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const body = await req.json();
  const message_it = String(body.message_it ?? "").slice(0, 2000);
  const message_en = String(body.message_en ?? message_it ?? "").slice(0, 2000);
  if (!message_it.trim()) {
    return NextResponse.json({ ok: false, error: "message_it required" }, { status: 400 });
  }

  const status = ["investigating", "identified", "monitoring", "resolved"].includes(body.status)
    ? body.status
    : "investigating";

  const update = await prisma.incidentUpdate.create({
    data: { incident_id: id, status, message_it, message_en },
  });

  // Sync the parent incident's status field with the latest update
  await prisma.incident.update({
    where: { id },
    data: {
      status,
      resolved_at: status === "resolved" ? new Date() : inc.resolved_at,
    },
  });

  return NextResponse.json({ ok: true, update });
}
