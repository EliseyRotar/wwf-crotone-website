/**
 * PATCH /api/admin/status/incidents/[id] — update an incident (resolve, change severity)
 *
 * Most common use: PATCH with `{ resolved_at: new Date().toISOString() }`
 * to close an incident. The UI also lets you change severity and status.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const PatchIncidentSchema = z
  .object({
    severity: z.enum(["minor", "major", "critical"]).optional(),
    status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional(),
    title_it: z.string().trim().min(1).max(200).optional(),
    title_en: z.string().trim().max(200).optional(),
    body_it: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    body_en: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    resolved_at: z.string().min(8).max(40).nullable().optional()
  })
  .strict();

function parseDateOrNull(value: string | null): Date | null {
  if (value === null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

  const parsed = PatchIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if (k === "resolved_at") {
      const d = parseDateOrNull(v as string | null);
      if (v !== null && !d) {
        return NextResponse.json({ ok: false, error: "invalid-resolved-at" }, { status: 400 });
      }
      data[k] = d;
    } else {
      data[k] = v;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "no-edits" }, { status: 400 });
  }

  // If we've just resolved, also set status to "resolved" if not already set
  if (data.resolved_at && !("status" in data)) {
    data.status = "resolved";
  }

  const updated = await prisma.incident.update({ where: { id }, data });
  return NextResponse.json({ ok: true, incident: updated });
}
