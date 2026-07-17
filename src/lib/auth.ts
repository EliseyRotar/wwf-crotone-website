import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const PLACEHOLDER = "change-me-with-openssl-rand-base64-32";
const DEV_FALLBACK = "dev-secret-change-me";

function getSecret(): string {
  const raw = process.env.AUTH_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set in production. Generate with: openssl rand -base64 48");
    }
    return DEV_FALLBACK;
  }
  if (raw === PLACEHOLDER || raw.includes("change-me")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is still the placeholder. Generate a real secret with: openssl rand -base64 48");
    }
  }
  if (raw.length < 32) {
    console.warn("AUTH_SECRET is shorter than 32 chars — consider using a stronger secret.");
  }
  return raw;
}

const COOKIE_NAME = "wwf_admin_session";

function getKey() {
  return new TextEncoder().encode(getSecret());
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "superadmin" | "manager";
  assignedTurns: string | null;
};

export async function signSession(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getKey());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  // Re-validate against DB so deleted/demoted/expired users lose access immediately
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { role: true, assignedTurns: true, email: true, name: true, active: true, expiresAt: true }
  });
  if (!user || !user.active) return null;
  if (user.expiresAt && user.expiresAt.getTime() < Date.now()) return null; // expired
  // Return refreshed role/turns (not the stale token values)
  return {
    id: payload.id,
    email: user.email,
    name: user.name,
    role: user.role as "superadmin" | "manager",
    assignedTurns: user.assignedTurns
  };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  const isLocalhost = process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost") ?? false;
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !isLocalhost,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  if (!user.active) return null; // disabled account
  if (user.expiresAt && user.expiresAt.getTime() < Date.now()) return null; // expired
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "superadmin" | "manager",
    assignedTurns: user.assignedTurns
  };
}

export function canAccessTurn(session: SessionUser, turnoId: string): boolean {
  if (session.role === "superadmin") return true;
  if (!session.assignedTurns) return false;
  return session.assignedTurns.split(",").includes(turnoId);
}