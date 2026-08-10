/**
 * GET  /api/admin/status/services — list all StatusService rows (admin only)
 * POST /api/admin/status/services — create a new Service (superadmin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const services = await prisma.statusService.findMany({
    orderBy: [{ category: "asc" }, { display_order: "asc" }],
  });
  return NextResponse.json({ ok: true, services });
}

export async function POST(req: NextRequest) {
  const session = await requireSuperadmin();
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-svc-create:${clientKey(req)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await req.json();
  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid slug" }, { status: 400 });
  }

  const created = await prisma.statusService.create({
    data: {
      slug,
      name_it: String(body.name_it ?? slug).slice(0, 200),
      name_en: String(body.name_en ?? slug).slice(0, 200),
      category: ["user-facing", "infrastructure", "external"].includes(body.category)
        ? body.category
        : "external",
      display_order: Number(body.display_order ?? 999),
      source: ["uptimerobot", "statuspage", "self-probe", "instatus", "manual"].includes(body.source)
        ? body.source
        : "manual",
      source_id: body.source_id ? String(body.source_id) : null,
      url: body.url ? String(body.url) : null,
      icon: body.icon ? String(body.icon) : null,
      description_it: body.description_it ?? null,
      description_en: body.description_en ?? null,
    },
  });

  return NextResponse.json({ ok: true, service: created });
}
