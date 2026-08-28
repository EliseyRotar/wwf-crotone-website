/**
 * GET   /api/admin/status/incidents — list all incidents (any admin)
 * POST  /api/admin/status/incidents — create a new incident (superadmin)
 *
 * Repository: prisma.incident — matches the StatusIncident Prisma model
 * (SchemaStatus.Incident). Created by admin manually here, or by the
 * cron worker when it imports from external statuspages.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

const CreateIncidentSchema = z
  .object({
    service_slug: z.string().trim().min(2).max(60).regex(SLUG_RE, "invalid service slug"),
    severity: z.enum(["minor", "major", "critical"]).optional().default("minor"),
    status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional().default("investigating"),
    title_it: z.string().trim().min(1).max(200),
    title_en: z.string().trim().max(200).optional(),
    body_it: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    body_en: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    started_at: z.string().min(8).max(40).optional(),
    resolved_at: z.string().min(8).max(40).nullable().optional()
  })
  .strict();

function parseDateOrNull(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const includeResolved = url.searchParams.get("include_resolved") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const incidents = await prisma.incident.findMany({
    where: includeResolved ? {} : { resolved_at: null },
    orderBy: [{ started_at: "desc" }],
    take: limit,
    include: {
      updates: { orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json({ ok: true, incidents });
}

export async function POST(req: NextRequest) {
  const session = await requireSuperadmin();
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-inc-create:${clientKey(req)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = CreateIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const serviceSlug = d.service_slug.toLowerCase();
  const svc = await prisma.statusService.findUnique({ where: { slug: serviceSlug } });
  if (!svc) return NextResponse.json({ ok: false, error: "service not found" }, { status: 400 });

  const startedRaw = parseDateOrNull(d.started_at);
  if (d.started_at && !startedRaw) {
    return NextResponse.json({ ok: false, error: "invalid-started-at" }, { status: 400 });
  }
  const resolvedRaw = parseDateOrNull(d.resolved_at ?? null);
  if (d.resolved_at && !resolvedRaw) {
    return NextResponse.json({ ok: false, error: "invalid-resolved-at" }, { status: 400 });
  }

  const incident = await prisma.incident.create({
    data: {
      service_id: svc.id,
      source: "manual",
      external_id: null,
      severity: d.severity,
      status: d.status,
      title_it: d.title_it.slice(0, 200),
      title_en: (d.title_en ?? d.title_it).slice(0, 200),
      body_it: d.body_it ?? "",
      body_en: d.body_en ?? d.body_it ?? "",
      started_at: startedRaw ?? new Date(),
      resolved_at: resolvedRaw
    }
  });

  return NextResponse.json({ ok: true, incident });
}
