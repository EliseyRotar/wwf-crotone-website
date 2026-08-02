import { describe, it, expect, vi, beforeEach } from "vitest";
import { isUnder18, calcAge } from "@/lib/turns";
import { validateEmail, validateLength, sanitizeHtml, LIMITS } from "@/lib/validate";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { canAccessTurn } from "@/lib/auth";

/**
 * Integration tests for the booking (iscrizione) flow.
 *
 * This test exercises the same validation pipeline that the
 * /api/iscrizione POST route runs, without spinning up Next.js.
 * The aim is to assert that the security & business rules are
 * applied in the expected order and produce the expected outcomes.
 */

type BookingPayload = {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  isMinor: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianConsent?: boolean;
  turnoIds: string[];
  privacyConsent: boolean;
  website?: string; // honeypot
};

const CAMP_START = new Date("2026-06-21");

function makeReq(headers: Record<string, string>, body: unknown, ipSuffix: string = ""): Request {
  // Force dev-mode so clientKey() trusts x-forwarded-for (matches reality in CI).
  (process.env as Record<string, string>).NODE_ENV = "test";
  const finalHeaders: Record<string, string> = {
    "content-type": "application/json",
    origin: "http://localhost:3000",
    ...headers
  };
  if (ipSuffix) {
    finalHeaders["x-forwarded-for"] = ipSuffix;
  }
  return new Request("https://wwf-crotone.example/api/iscrizione", {
    method: "POST",
    headers: finalHeaders,
    body: JSON.stringify(body)
  });
}

function validateBookingShape(body: unknown): { ok: true; data: BookingPayload } | { ok: false; reason: string } {
  if (typeof body !== "object" || body === null) return { ok: false, reason: "body" };
  const b = body as Record<string, unknown>;

  if (typeof b.firstName !== "string" || !validateLength(b.firstName, LIMITS.MAX_NAME)) {
    return { ok: false, reason: "firstName" };
  }
  if (typeof b.lastName !== "string" || !validateLength(b.lastName, LIMITS.MAX_NAME)) {
    return { ok: false, reason: "lastName" };
  }
  if (typeof b.email !== "string" || !validateEmail(b.email)) {
    return { ok: false, reason: "email" };
  }
  if (typeof b.phone !== "string" || !validateLength(b.phone, LIMITS.MAX_PHONE)) {
    return { ok: false, reason: "phone" };
  }
  if (typeof b.birthDate !== "string") return { ok: false, reason: "birthDate" };
  if (typeof b.isMinor !== "boolean") return { ok: false, reason: "isMinor" };
  if (!Array.isArray(b.turnoIds) || b.turnoIds.length === 0) return { ok: false, reason: "turnoIds" };
  if (b.privacyConsent !== true) return { ok: false, reason: "privacyConsent" };

  return { ok: true, data: b as unknown as BookingPayload };
}

async function runBookingPipeline(req: Request, body: unknown): Promise<{ status: number; error?: string }> {
  // 1. CSRF
  if (!validateOrigin(req)) return { status: 403, error: "csrf" };

  // 2. Rate limit (C-01: now async)
  if (!(await rateLimit(`isc:${clientKey(req)}`, 3, 3600_000))) {
    return { status: 429, error: "rate-limited" };
  }

  // 3. Honeypot — short-circuit
  if ((body as { website?: string })?.website) return { status: 200 };

  // 4. Shape validation
  const v = validateBookingShape(body);
  if (!v.ok) return { status: 400, error: "validation" };

  // 5. Birth date sanity
  const birthMs = Date.parse(v.data.birthDate);
  if (isNaN(birthMs)) return { status: 400, error: "validation" };
  const birth = new Date(birthMs);
  if (birth.getTime() > Date.now()) return { status: 400, error: "birth-future" };

  // 6. Server-side age recheck
  const serverMinor = isUnder18(birth, CAMP_START);
  if (serverMinor !== v.data.isMinor) return { status: 400, error: "minor-mismatch" };

  // 7. Guardian required for minors
  if (serverMinor) {
    if (!v.data.guardianName || !v.data.guardianPhone || v.data.guardianConsent !== true) {
      return { status: 400, error: "guardian-required" };
    }
  }

  return { status: 200 };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
});

describe("booking flow — happy path", () => {
  it("accepts a valid adult booking", async () => {
    const body = {
      firstName: "Mario",
      lastName: "Rossi",
      birthDate: "1995-04-10",
      email: "mario@example.com",
      phone: "+39 333 1234567",
      isMinor: false,
      turnoIds: ["T1"],
      privacyConsent: true
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.0.1"), body);
    expect(out).toEqual({ status: 200 });
  });

  it("accepts a valid minor booking with guardian info", async () => {
    const body = {
      firstName: "Lucia",
      lastName: "Bianchi",
      birthDate: "2010-09-01",
      email: "parent@example.com",
      phone: "+39 333 7654327",
      isMinor: true,
      guardianName: "Anna Bianchi",
      guardianPhone: "+39 333 1111111",
      guardianConsent: true,
      turnoIds: ["T2"],
      privacyConsent: true
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.0.2"), body);
    expect(out).toEqual({ status: 200 });
  });
});

describe("booking flow — CSRF", () => {
  it("rejects when origin is not in the allow list", async () => {
    const body = { firstName: "a", lastName: "b", birthDate: "1995-01-01", email: "a@b.com", phone: "12345", isMinor: false, turnoIds: ["T1"], privacyConsent: true };
    const out = await runBookingPipeline(makeReq({ origin: "https://evil.example" }, body, "10.0.1.1"), body);
    expect(out).toEqual({ status: 403, error: "csrf" });
  });

  it("rejects when no origin and no referer are present", async () => {
    const body = { firstName: "a", lastName: "b", birthDate: "1995-01-01", email: "a@b.com", phone: "12345", isMinor: false, turnoIds: ["T1"], privacyConsent: true };
    const out = await runBookingPipeline(makeReq({ origin: "" }, body, "10.0.1.2"), body);
    expect(out).toEqual({ status: 403, error: "csrf" });
  });
});

describe("booking flow — rate limiting", () => {
  it("returns 429 after 3 requests from the same IP within the window", async () => {
    const body = { firstName: "a", lastName: "b", birthDate: "1995-01-01", email: "a@b.com", phone: "12345", isMinor: false, turnoIds: ["T1"], privacyConsent: true };
    const req = makeReq({}, body, "10.0.2.1");
    const r1 = await runBookingPipeline(req, body);
    const r2 = await runBookingPipeline(req, body);
    const r3 = await runBookingPipeline(req, body);
    const r4 = await runBookingPipeline(req, body);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r4.status).toBe(429);
  });
});

describe("booking flow — honeypot", () => {
  it("silently accepts (returns 200) when honeypot is filled", async () => {
    const body = {
      firstName: "Bot",
      lastName: "Bot",
      birthDate: "1990-01-01",
      email: "bot@bot.com",
      phone: "0",
      isMinor: false,
      turnoIds: ["T1"],
      privacyConsent: true,
      website: "http://spam.example"
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.3.1"), body);
    expect(out).toEqual({ status: 200 });
  });
});

describe("booking flow — validation", () => {
  const validBody = {
    firstName: "Mario",
    lastName: "Rossi",
    birthDate: "1995-04-10",
    email: "mario@example.com",
    phone: "+39 333 1234567",
    isMinor: false,
    turnoIds: ["T1"],
    privacyConsent: true
  };

  it("rejects when firstName is missing", async () => {
    const { firstName, ...body } = validBody;
    void firstName;
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.1"), body);
    expect(out).toEqual({ status: 400, error: "validation" });
  });

  it("rejects when firstName exceeds max length", async () => {
    const body = { ...validBody, firstName: "A".repeat(LIMITS.MAX_NAME + 1) };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.2"), body);
    expect(out).toEqual({ status: 400, error: "validation" });
  });

  it("rejects when email is invalid", async () => {
    const body = { ...validBody, email: "not-an-email" };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.3"), body);
    expect(out).toEqual({ status: 400, error: "validation" });
  });

  it("rejects when turnoIds is empty", async () => {
    const body = { ...validBody, turnoIds: [] };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.4"), body);
    expect(out).toEqual({ status: 400, error: "validation" });
  });

  it("rejects when privacyConsent is not true", async () => {
    const body = { ...validBody, privacyConsent: false };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.5"), body);
    expect(out).toEqual({ status: 400, error: "validation" });
  });

  it("rejects when birthDate is malformed", async () => {
    const body = { ...validBody, birthDate: "not-a-date" };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.6"), body);
    expect(out).toEqual({ status: 400, error: "validation" });
  });

  it("rejects when birthDate is in the future", async () => {
    const body = { ...validBody, birthDate: "2099-01-01" };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.4.7"), body);
    expect(out).toEqual({ status: 400, error: "birth-future" });
  });
});

describe("booking flow — minor mismatch", () => {
  it("rejects when client claims isMinor=true but server says >= 18", async () => {
    const body = {
      firstName: "Mario",
      lastName: "Rossi",
      birthDate: "1995-04-10",
      email: "mario@example.com",
      phone: "+39 333 1234567",
      isMinor: true, // lying
      turnoIds: ["T1"],
      privacyConsent: true
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.5.1"), body);
    expect(out).toEqual({ status: 400, error: "minor-mismatch" });
  });

  it("rejects when client claims isMinor=false but server says < 18", async () => {
    const body = {
      firstName: "Lucia",
      lastName: "Bianchi",
      birthDate: "2012-01-01",
      email: "parent@example.com",
      phone: "+39 333 7654327",
      isMinor: false, // lying
      turnoIds: ["T1"],
      privacyConsent: true
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.5.2"), body);
    expect(out).toEqual({ status: 400, error: "minor-mismatch" });
  });
});

describe("booking flow — guardian required for minors", () => {
  it("rejects minor booking without guardian name", async () => {
    const body = {
      firstName: "Lucia",
      lastName: "Bianchi",
      birthDate: "2012-01-01",
      email: "p@example.com",
      phone: "+39 333 7654327",
      isMinor: true,
      guardianPhone: "+39 333 1111111",
      guardianConsent: true,
      turnoIds: ["T1"],
      privacyConsent: true
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.6.1"), body);
    expect(out).toEqual({ status: 400, error: "guardian-required" });
  });

  it("rejects minor booking without guardian consent", async () => {
    const body = {
      firstName: "Lucia",
      lastName: "Bianchi",
      birthDate: "2012-01-01",
      email: "p@example.com",
      phone: "+39 333 7654327",
      isMinor: true,
      guardianName: "Anna",
      guardianPhone: "+39 333 1111111",
      // guardianConsent missing
      turnoIds: ["T1"],
      privacyConsent: true
    };
    const out = await runBookingPipeline(makeReq({}, body, "10.0.6.2"), body);
    expect(out).toEqual({ status: 400, error: "guardian-required" });
  });
});

describe("calcAge + isUnder18 boundary", () => {
  it("exactly 18 on camp start day returns false for isUnder18", () => {
    const birth = new Date("2008-06-21");
    const ref = new Date("2026-06-21");
    expect(calcAge(birth, ref)).toBe(18);
    expect(isUnder18(birth, ref)).toBe(false);
  });

  it("one day before turning 18 is still under 18", () => {
    const birth = new Date("2008-06-22");
    const ref = new Date("2026-06-21");
    expect(calcAge(birth, ref)).toBe(17);
    expect(isUnder18(birth, ref)).toBe(true);
  });
});

describe("sanitizeHtml within the flow", () => {
  it("strips a stored XSS attempt in a free-text field", () => {
    const evil = '<p>ok</p><script>alert(1)</script>';
    const clean = sanitizeHtml(evil);
    expect(clean).not.toContain("<script");
    expect(clean).toContain("<p>ok</p>");
  });
});
