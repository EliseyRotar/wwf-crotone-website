/**
 * GET /api/status — public status overview.
 *
 * Returns the full StatusOverview JSON (overall status, per-service
 * cards, active and recent incidents). Heavy but bounded by the
 * StatusService row count (~24). Cached at the CDN for 30s with a
 * 60s stale-while-revalidate so we don't hammer the DB on the
 * public page's 30s auto-refresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStatusOverview } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") ?? "it";
  const lookback = Number(req.nextUrl.searchParams.get("hours") ?? "24");

  try {
    const data = await getStatusOverview(locale, Math.min(Math.max(lookback, 1), 168));
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/status] error", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
