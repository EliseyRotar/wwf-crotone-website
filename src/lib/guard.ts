import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth";

/**
 * Page-level guards. Use in Server Components and Server Actions.
 * On auth failure, throw a redirect via next/navigation.
 */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const s = await requireSession();
  if (s.role !== "superadmin") redirect("/admin");
  return s;
}

/**
 * API-route guards. Use in route.ts handlers under /api/admin/*.
 * On auth failure, return a NextResponse (403/401) instead of calling
 * redirect() — Next.js's redirect() throws an internal error which
 * surfaces as a 500 in API routes instead of the intended 403.
 */
export async function requireSessionApi(): Promise<SessionUser | NextResponse> {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return s;
}

export async function requireSuperadminApi(): Promise<SessionUser | NextResponse> {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (s.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return s;
}
