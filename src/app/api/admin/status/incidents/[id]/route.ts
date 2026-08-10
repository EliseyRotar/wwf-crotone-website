/**
 * PATCH /api/admin/status/incidents/[id] — update an incident (resolve, change severity)
 *
 * Most common use: PATCH with `{ resolved_at: new Date().toISOString() }`
 * to close an incident. The UI also lets you change severity and status.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ALLOWED = ["severity", "status", "title_it", "title_en", "body_it", "body_en", "resolved_at"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadmin();
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-inc-patch:${clientKey(req)}`, 30, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { id } = await params;
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) {
      if (k === "resolved_at" && body[k]) {
        data[k] = new Date(body[k] as string);
      } else {
        data[k] = body[k];
      }
    }
  }

  // If we've just resolved, also set status to "resolved" if not already set
  if (data.resolved_at && !("status" in data)) {
    data.status = "resolved";
  }

  const updated = await prisma.incident.update({ where: { id }, data });
  return NextResponse.json({ ok: true, incident: updated });
}
