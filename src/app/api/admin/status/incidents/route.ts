/**
 * GET   /api/admin/status/incidents — list all incidents (any admin)
 * POST  /api/admin/status/incidents — create a new incident (superadmin)
 *
 * Repository: prisma.incident — matches the StatusIncident Prisma model
 * (SchemaStatus.Incident). Created by admin manually here, or by the
 * cron worker when it imports from external statuspages.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

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

  const body = await req.json();
  const service_slug = String(body.service_slug ?? "").trim();
  const svc = await prisma.statusService.findUnique({ where: { slug: service_slug } });
  if (!svc) return NextResponse.json({ ok: false, error: "service not found" }, { status: 400 });

  const incident = await prisma.incident.create({
    data: {
      service_id: svc.id,
      source: "manual",
      external_id: null,
      severity: ["minor", "major", "critical"].includes(body.severity) ? body.severity : "minor",
      status: ["investigating", "identified", "monitoring", "resolved"].includes(body.status)
        ? body.status
        : "investigating",
      title_it: String(body.title_it ?? "").slice(0, 200),
      title_en: String(body.title_en ?? body.title_it ?? "").slice(0, 200),
      body_it: body.body_it ?? null,
      body_en: body.body_en ?? body.body_it ?? null,
      started_at: body.started_at ? new Date(body.started_at) : new Date(),
      resolved_at: body.resolved_at ? new Date(body.resolved_at) : null,
    },
  });

  return NextResponse.json({ ok: true, incident });
}
