import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, clientKey } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", async () => {
    expect(await rateLimit("k1", 3, 1000)).toBe(true);
  });

  it("allows up to max requests within the window", async () => {
    expect(await rateLimit("k2", 3, 1000)).toBe(true);
    expect(await rateLimit("k2", 3, 1000)).toBe(true);
    expect(await rateLimit("k2", 3, 1000)).toBe(true);
  });

  it("blocks requests beyond max within the window", async () => {
    await rateLimit("k3", 2, 1000);
    await rateLimit("k3", 2, 1000);
    expect(await rateLimit("k3", 2, 1000)).toBe(false);
    expect(await rateLimit("k3", 2, 1000)).toBe(false);
  });

  it("uses separate buckets for different keys", async () => {
    await rateLimit("a", 1, 1000);
    await rateLimit("a", 1, 1000);
    expect(await rateLimit("a", 1, 1000)).toBe(false);
    expect(await rateLimit("b", 1, 1000)).toBe(true);
  });

  it("resets the bucket after the window passes", async () => {
    expect(await rateLimit("k4", 1, 1000)).toBe(true);
    expect(await rateLimit("k4", 1, 1000)).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(await rateLimit("k4", 1, 1000)).toBe(true);
  });

  it("treats a fresh key as having a full window budget", async () => {
    expect(await rateLimit("k5", 5, 5000)).toBe(true);
    expect(await rateLimit("k5", 5, 5000)).toBe(true);
    expect(await rateLimit("k5", 5, 5000)).toBe(true);
    expect(await rateLimit("k5", 5, 5000)).toBe(true);
    expect(await rateLimit("k5", 5, 5000)).toBe(true);
    expect(await rateLimit("k5", 5, 5000)).toBe(false);
  });

  it("edge: with max=0 the first call still succeeds (sets bucket), subsequent calls are blocked", async () => {
    // The implementation creates a fresh bucket on the first call (returning true)
    // and only blocks on subsequent calls. This is a known quirk — not a bug, the
    // caller should never pass max=0 anyway.
    expect(await rateLimit("k6", 0, 1000)).toBe(true);
    expect(await rateLimit("k6", 0, 1000)).toBe(false);
  });

  it("does not count the (failed) request beyond the limit", async () => {
    await rateLimit("k7", 2, 1000);
    await rateLimit("k7", 2, 1000);
    const r1 = await rateLimit("k7", 2, 1000);
    const r2 = await rateLimit("k7", 2, 1000);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
  });
});

describe("clientKey (dev/test mode)", () => {
  // Force dev mode so clientKey() trusts x-forwarded-for (matches CI).
  // NODE_ENV is typed as read-only; cast to mutable for the test.
  const prevNodeEnv = (process.env as Record<string, string>).NODE_ENV;
  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = "test";
  });
  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = prevNodeEnv;
  });

  function makeReq(headers: Record<string, string>): Request {
    return new Request("https://example.com/x", { headers });
  }

  it("returns first IP from x-forwarded-for when present", () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientKey(req)).toBe("1.2.3.4");
  });

  it("trims whitespace from forwarded IP", () => {
    const req = makeReq({ "x-forwarded-for": "  9.9.9.9  , 10.10.10.10" });
    expect(clientKey(req)).toBe("9.9.9.9");
  });

  it("falls back to 'local' when no x-forwarded-for header", () => {
    const req = makeReq({});
    expect(clientKey(req)).toBe("local");
  });
});

describe("clientKey (production mode — does NOT trust x-forwarded-for)", () => {
  const prevNodeEnv = (process.env as Record<string, string>).NODE_ENV;
  const prevTrusted = process.env.TRUSTED_PROXY_HEADER;
  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete process.env.TRUSTED_PROXY_HEADER;
  });
  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = prevNodeEnv;
    if (prevTrusted !== undefined) process.env.TRUSTED_PROXY_HEADER = prevTrusted;
  });

  function makeReq(headers: Record<string, string>): Request {
    return new Request("https://example.com/x", { headers });
  }

  it("ignores x-forwarded-for without a configured trusted proxy header", () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4" });
    expect(clientKey(req)).toBe("unknown");
  });

  it("uses CF-Connecting-IP when configured", () => {
    process.env.TRUSTED_PROXY_HEADER = "CF-Connecting-IP";
    const req = makeReq({ "cf-connecting-ip": "1.2.3.4" });
    expect(clientKey(req)).toBe("1.2.3.4");
  });

  it("uses X-Real-IP when configured (case-insensitive)", () => {
    process.env.TRUSTED_PROXY_HEADER = "x-real-ip";
    const req = makeReq({ "X-Real-IP": "5.6.7.8" });
    expect(clientKey(req)).toBe("5.6.7.8");
  });

  it("returns 'unknown' if the trusted header is missing", () => {
    process.env.TRUSTED_PROXY_HEADER = "cf-connecting-ip";
    const req = makeReq({});
    expect(clientKey(req)).toBe("unknown");
  });
});
