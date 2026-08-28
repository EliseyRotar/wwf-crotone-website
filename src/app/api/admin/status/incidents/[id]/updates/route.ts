/**
 * POST /api/admin/status/incidents/[id]/updates — append an update to an incident timeline.
 *
 * When the operator types "We've identified the root cause" in the admin
 * UI, this is where it lands. Replies are localized (it + en) so the
 * public page can pick the right language.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const IncidentUpdateSchema = z
  .object({
    message_it: z.string().trim().min(1).max(2000).optional(),
    message_en: z.string().trim().max(2000).optional(),
    body_it: z.string().trim().min(1).max(2000).optional(),
    body_en: z.string().trim().max(2000).optional(),
    status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.message_it && !data.body_it) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["message_it"],
        message: "message_it required"
      });
    }
  });

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
  if (!id || id.length > 64) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = IncidentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const body_it = (d.message_it ?? d.body_it ?? "").slice(0, 2000);
  const body_en = (d.message_en ?? d.body_en ?? body_it).slice(0, 2000);
  const status = d.status ?? "investigating";

  const update = await prisma.incidentUpdate.create({
    data: { incident_id: id, status, body_it, body_en }
  });

  // Sync the parent incident's status field with the latest update
  await prisma.incident.update({
    where: { id },
    data: {
      status,
      resolved_at: status === "resolved" ? new Date() : inc.resolved_at
    }
  });

  return NextResponse.json({ ok: true, update });
}
