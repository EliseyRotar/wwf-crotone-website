/**
 * GET  /api/admin/status/services — list all StatusService rows (admin only)
 * POST /api/admin/status/services — create a new Service (superadmin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireSuperadminApi } from "@/lib/guard";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const services = await prisma.statusService.findMany({
    orderBy: [{ category: "asc" }, { display_order: "asc" }],
  });
  return NextResponse.json({ ok: true, services });
}

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

const CreateServiceSchema = z
  .object({
    slug: z.string().trim().min(2).max(60).regex(SLUG_RE, "invalid slug"),
    name_it: z.string().trim().max(200).optional(),
    name_en: z.string().trim().max(200).optional(),
    category: z.enum(["user-facing", "infrastructure", "external"]).optional().default("external"),
    display_order: z.number().int().min(0).max(1_000_000).optional().default(999),
    source: z
      .enum(["uptimerobot", "statuspage", "self-probe", "instatus", "manual"])
      .optional()
      .default("manual"),
    source_id: z.string().max(200).nullable().optional(),
    url: z.string().url().max(2000).nullable().optional(),
    icon: z.string().max(200).nullable().optional(),
    description_it: z.string().max(LIMITS.MAX_STRING).nullable().optional(),
    description_en: z.string().max(LIMITS.MAX_STRING).nullable().optional()
  })
  .strict();

export async function POST(req: NextRequest) {
  const sessionOrResp = await requireSuperadminApi();
  if (sessionOrResp instanceof NextResponse) return sessionOrResp;
  const session = sessionOrResp;
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`admin-status-svc-create:${clientKey(req)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const parsed = CreateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const slug = d.slug.toLowerCase();

  const created = await prisma.statusService.create({
    data: {
      slug,
      name_it: (d.name_it ?? slug).slice(0, 200),
      name_en: (d.name_en ?? slug).slice(0, 200),
      category: d.category,
      display_order: d.display_order,
      source: d.source,
      source_id: d.source_id ?? null,
      url: d.url ?? null,
      icon: d.icon ?? null,
      description_it: d.description_it ?? null,
      description_en: d.description_en ?? null
    }
  });

  return NextResponse.json({ ok: true, service: created });
}
