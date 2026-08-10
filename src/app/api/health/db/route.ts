/**
 * GET /api/health/db — public health probe for the Postgres database.
 *
 * Used by UptimeRobot + the status page's external check. Same shape
 * as /api/health for consistency, but checks the DB only. Returns 200
 * if the connection works, 503 if it doesn't.
 *
 * We probe the DB through the Prisma client (which is the only way
 * the app itself talks to the DB), so a green light here means the
 * app can also reach the database.
 *
 * Public by design (no auth) because it's a healthcheck: anyone
 * wanting to know if we're up can curl this.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "postgres",
      db: "ok",
      latency_ms: Date.now() - t0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, service: "postgres", db: "error", error: String(err) },
      { status: 503 }
    );
  }
}
