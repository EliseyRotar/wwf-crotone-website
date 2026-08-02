import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, db: "error", error: String(err) }, { status: 503 });
  }
}
