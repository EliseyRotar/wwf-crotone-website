/**
 * GET /api/status/[slug]/history — 24h spark line for one service.
 *
 * Returns bucketed points (15-min resolution) so the public page can
 * draw a small up-time strip. Cached at the CDN for 60s.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceHistory, getServiceUptime } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const hours = Number(req.nextUrl.searchParams.get("hours") ?? "24");

  try {
    const [history, uptime7d, uptime30d] = await Promise.all([
      getServiceHistory(slug, Math.min(Math.max(hours, 1), 168)),
      getServiceUptime(slug, 7),
      getServiceUptime(slug, 30),
    ]);
    if (!history) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ...history, uptime_7d: uptime7d?.uptime_pct ?? null, uptime_30d: uptime30d?.uptime_pct ?? null },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    console.error("[/api/status/:slug/history] error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
