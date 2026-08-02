import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
