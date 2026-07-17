import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth";

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