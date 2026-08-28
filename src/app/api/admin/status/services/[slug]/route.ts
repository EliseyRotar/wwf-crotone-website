/**
 * PATCH  /api/admin/status/services/[slug] — edit a service (superadmin)
 * DELETE /api/admin/status/services/[slug] — soft-delete (set active=false)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperadminApi } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

const SLUG_PARAM_RE = /^[a-z0-9-]{2,60}$/;

const PatchServiceSchema = z
  .object({
    name_it: z.string().trim().max(200).optional(),
    name_en: z.string().trim().max(200).optional(),
    category: z.enum(["user-facing", "infrastructure", "external"]).optional(),
    display_order: z.number().int().min(0).max(1_000_000).optional(),
    source: z
      .enum(["uptimerobot", "statuspage", "self-probe", "instatus", "manual"])
      .optional(),
    source_id: z.string().max(200).nullable().optional(),
    url: z.string().url().max(2000).nullable().optional(),
    icon: z.string().max(200).nullable().optional(),
    description_it: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    description_en: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    active: z.boolean().optional()
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const sessionOrResp = await requireSuperadminApi();
  if (sessionOrResp instanceof NextResponse) return sessionOrResp;
  const session = sessionOrResp;
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-svc-patch:${clientKey(req)}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { slug } = await params;
  if (!SLUG_PARAM_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid-slug" }, { status: 400 });
  }
  const svc = await prisma.statusService.findUnique({ where: { slug } });
  if (!svc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = PatchServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "no-edits" }, { status: 400 });
  }

  const updated = await prisma.statusService.update({ where: { slug }, data });
  return NextResponse.json({ ok: true, service: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const sessionOrResp2 = await requireSuperadminApi();
  if (sessionOrResp2 instanceof NextResponse) return sessionOrResp2;
  const session = sessionOrResp2;
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-svc-delete:${clientKey(req)}`, 5, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const { slug } = await params;
  if (!SLUG_PARAM_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid-slug" }, { status: 400 });
  }
  // Soft delete so we keep historical snapshots/periods readable
  await prisma.statusService.update({ where: { slug }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
