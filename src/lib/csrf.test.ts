import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api", { headers });
}

describe("validateOrigin (dev / no NEXT_PUBLIC_SITE_URL)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("accepts http://localhost:3000", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "http://localhost:3000" }))).toBe(true);
  });

  it("accepts http://localhost:3001", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "http://localhost:3001" }))).toBe(true);
  });

  it("rejects 127.0.0.1 (not in the allow list)", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "http://127.0.0.1:3000" }))).toBe(false);
  });

  it("rejects an HTTPS localhost attempt (scheme mismatch)", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "https://localhost:3000" }))).toBe(false);
  });

  it("rejects arbitrary origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "https://example.com" }))).toBe(false);
  });

  it("rejects when origin is missing and referer is missing", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({}))).toBe(false);
  });
});

describe("validateOrigin (with NEXT_PUBLIC_SITE_URL configured)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://wwf-crotone.example";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("accepts exact match of configured origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "https://wwf-crotone.example" }))).toBe(true);
  });

  it("accepts exact match of localhost:3000 (still in allow list)", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "http://localhost:3000" }))).toBe(true);
  });

  it("rejects prefix attack (origin with extra suffix)", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    // exact equality, not substring
    expect(validateOrigin(makeRequest({ origin: "https://wwf-crotone.example.evil.com" }))).toBe(false);
  });

  it("rejects different scheme", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "http://wwf-crotone.example" }))).toBe(false);
  });

  it("rejects different port", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "https://wwf-crotone.example:8443" }))).toBe(false);
  });

  it("rejects subdomain of allowed origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "https://api.wwf-crotone.example" }))).toBe(false);
  });

  it("rejects completely different origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ origin: "https://evil.example" }))).toBe(false);
  });

  it("accepts when referer matches allowed origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ referer: "https://wwf-crotone.example/some/path" }))).toBe(true);
  });

  it("rejects when referer is from a different origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ referer: "https://evil.example/path" }))).toBe(false);
  });

  it("rejects when referer is malformed", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({ referer: "not-a-url" }))).toBe(false);
  });

  it("trusts origin when both are present and origin is valid", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({
      origin: "https://wwf-crotone.example",
      referer: "https://evil.example"
    }))).toBe(true);
  });

  it("rejects when origin is present but invalid (even with valid referer)", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    expect(validateOrigin(makeRequest({
      origin: "https://evil.example",
      referer: "https://wwf-crotone.example"
    }))).toBe(false);
  });
});
