/**
 * PATCH  /api/admin/status/services/[slug] — edit a service (superadmin)
 * DELETE /api/admin/status/services/[slug] — soft-delete (set active=false)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = [
  "name_it", "name_en", "category", "display_order", "source",
  "source_id", "url", "icon", "description_it", "description_en", "active",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await requireSuperadmin();
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-svc-patch:${clientKey(req)}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { slug } = await params;
  const svc = await prisma.statusService.findUnique({ where: { slug } });
  if (!svc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in body) data[k] = body[k];
  }

  const updated = await prisma.statusService.update({ where: { slug }, data });
  return NextResponse.json({ ok: true, service: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await requireSuperadmin();
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-svc-delete:${clientKey(req)}`, 5, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { slug } = await params;
  // Soft delete so we keep historical snapshots/periods readable
  await prisma.statusService.update({ where: { slug }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
