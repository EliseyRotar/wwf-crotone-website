import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return NextResponse.json({ ok: false, db: "unavailable" }, { status: 503 });
  }
}
