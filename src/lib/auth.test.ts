import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks must be set up before importing the module under test ---

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn()
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore)
}));

const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();

vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args)
  }
}));

const mockUserFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) }
  }
}));

import { canAccessTurn, verifySession, authenticate } from "@/lib/auth";
import { signSession } from "@/lib/auth";

const baseUser = {
  id: "u1",
  email: "u1@example.com",
  name: "User One",
  role: "superadmin" as const,
  assignedTurns: null
};

describe("canAccessTurn", () => {
  it("superadmin can access any turn", () => {
    expect(canAccessTurn({ ...baseUser, role: "superadmin" }, "T-anything")).toBe(true);
    expect(canAccessTurn({ ...baseUser, role: "superadmin" }, "")).toBe(true);
  });

  it("manager with empty assignedTurns cannot access any turn", () => {
    expect(canAccessTurn({ ...baseUser, role: "manager", assignedTurns: null }, "T1")).toBe(false);
    expect(canAccessTurn({ ...baseUser, role: "manager", assignedTurns: "" }, "T1")).toBe(false);
  });

  it("manager with assignedTurns can access only assigned turns", () => {
    const mgr = { ...baseUser, role: "manager" as const, assignedTurns: "T1,T2,T3" };
    expect(canAccessTurn(mgr, "T1")).toBe(true);
    expect(canAccessTurn(mgr, "T2")).toBe(true);
    expect(canAccessTurn(mgr, "T3")).toBe(true);
    expect(canAccessTurn(mgr, "T4")).toBe(false);
  });

  it("manager with single assigned turn", () => {
    const mgr = { ...baseUser, role: "manager" as const, assignedTurns: "T1" };
    expect(canAccessTurn(mgr, "T1")).toBe(true);
    expect(canAccessTurn(mgr, "T2")).toBe(false);
  });

  it("uses exact string match (no prefix match)", () => {
    const mgr = { ...baseUser, role: "manager" as const, assignedTurns: "T1" };
    expect(canAccessTurn(mgr, "T10")).toBe(false);
    expect(canAccessTurn(mgr, "T1A")).toBe(false);
  });

  it("trims whitespace on assigned turn id? (no — values are exact)", () => {
    const mgr = { ...baseUser, role: "manager" as const, assignedTurns: "T1, T2" };
    // Note: split(',') with a space after the comma will produce " T2" (with leading space),
    // so the lookup is case- and whitespace-sensitive.
    expect(canAccessTurn(mgr, "T1")).toBe(true);
    expect(canAccessTurn(mgr, "T2")).toBe(false); // because actual element is " T2"
    expect(canAccessTurn(mgr, " T2")).toBe(true);
  });
});

describe("verifySession", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-must-be-at-least-32-chars-long-xx";
  });

  it("returns null when token is undefined", async () => {
    expect(await verifySession(undefined)).toBeNull();
  });

  it("returns null when token is empty string", async () => {
    expect(await verifySession("")).toBeNull();
  });

  it("returns null for invalid/garbage token", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
  });

  it("returns the session payload for a valid signed token", async () => {
    const token = await signSession(baseUser);
    const out = await verifySession(token);
    expect(out).not.toBeNull();
    expect(out?.id).toBe(baseUser.id);
    expect(out?.email).toBe(baseUser.email);
    expect(out?.role).toBe("superadmin");
  });
});

describe("authenticate", () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockBcryptCompare.mockReset();
  });

  it("returns null when user does not exist", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    expect(await authenticate("nobody@example.com", "pw")).toBeNull();
  });

  it("returns null when account is inactive", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U",
      role: "manager",
      assignedTurns: null,
      active: false,
      expiresAt: null,
      passwordHash: "hash"
    });
    expect(await authenticate("u1@example.com", "pw")).toBeNull();
  });

  it("returns null when account is expired", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U",
      role: "manager",
      assignedTurns: null,
      active: true,
      expiresAt: new Date(Date.now() - 1000),
      passwordHash: "hash"
    });
    expect(await authenticate("u1@example.com", "pw")).toBeNull();
  });

  it("returns null when password is wrong", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U",
      role: "manager",
      assignedTurns: "T1",
      active: true,
      expiresAt: null,
      passwordHash: "hash"
    });
    mockBcryptCompare.mockResolvedValue(false);
    expect(await authenticate("u1@example.com", "wrong")).toBeNull();
  });

  it("returns session on success", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      name: "U",
      role: "superadmin",
      assignedTurns: null,
      active: true,
      expiresAt: null,
      passwordHash: "hash"
    });
    mockBcryptCompare.mockResolvedValue(true);
    const session = await authenticate("u1@example.com", "right");
    expect(session).not.toBeNull();
    expect(session?.email).toBe("u1@example.com");
    expect(session?.role).toBe("superadmin");
  });

  it("normalises email to lowercase before lookup", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await authenticate("USER@Example.COM", "pw");
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" }
    });
  });
});
