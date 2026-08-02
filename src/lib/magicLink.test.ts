import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the prisma client before importing the module under test.
const mockMagicLink = {
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn()
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    magicLink: {
      findUnique: (...args: unknown[]) => mockMagicLink.findUnique(...args),
      create: (...args: unknown[]) => mockMagicLink.create(...args),
      updateMany: (...args: unknown[]) => mockMagicLink.updateMany(...args),
      deleteMany: (...args: unknown[]) => mockMagicLink.deleteMany(...args)
    },
    iscrizione: {
      findFirst: vi.fn()
    }
  }
}));

import {
  generateMagicLink,
  consumeMagicLink,
  hashMagicToken,
  mintRawToken,
  buildMagicLinkUrl
} from "@/lib/magicLink";

describe("magicLink utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-must-be-at-least-32-chars-long-xx";
  });

  describe("mintRawToken", () => {
    it("returns a non-empty URL-safe string of ~43 chars", () => {
      const t = mintRawToken();
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(30);
      expect(/^[A-Za-z0-9_-]+$/.test(t)).toBe(true);
    });

    it("returns a different value on each call", () => {
      const a = mintRawToken();
      const b = mintRawToken();
      expect(a).not.toBe(b);
    });
  });

  describe("hashMagicToken", () => {
    it("is deterministic for the same input", async () => {
      const a = await hashMagicToken("hello");
      const b = await hashMagicToken("hello");
      expect(a).toBe(b);
    });

    it("produces different hashes for different inputs", async () => {
      const a = await hashMagicToken("hello");
      const b = await hashMagicToken("world");
      expect(a).not.toBe(b);
    });
  });

  describe("buildMagicLinkUrl", () => {
    it("uses the configured NEXT_PUBLIC_SITE_URL when set", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://wwf.example.com";
      const url = buildMagicLinkUrl("abc123", "it");
      expect(url).toBe("https://wwf.example.com/api/account/redeem?token=abc123&locale=it");
    });

    it("strips a trailing slash on the base", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://wwf.example.com/";
      const url = buildMagicLinkUrl("abc", "en");
      expect(url.startsWith("https://wwf.example.com/api/account/redeem")).toBe(true);
      expect(url).not.toContain("//api");
    });

    it("falls back to localhost when no env is set", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      const url = buildMagicLinkUrl("abc", "it");
      expect(url.startsWith("http://localhost:3000/api/account/redeem")).toBe(true);
    });

    it("url-encodes the token", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://wwf.example.com";
      const url = buildMagicLinkUrl("abc&?=", "it");
      expect(url).toContain("token=abc%26%3F%3D");
    });
  });
});
