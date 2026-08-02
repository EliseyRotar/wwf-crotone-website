import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isUnder18, calcAge, getTurnStatus, fmtDate } from "@/lib/turns";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSettings: { findFirst: vi.fn() }
  }
}));

describe("calcAge", () => {
  it("returns age when birthday already passed this year", () => {
    const birth = new Date("2000-01-15");
    const ref = new Date("2024-06-01");
    expect(calcAge(birth, ref)).toBe(24);
  });

  it("returns age - 1 when birthday has not yet occurred this year", () => {
    const birth = new Date("2000-12-15");
    const ref = new Date("2024-06-01");
    expect(calcAge(birth, ref)).toBe(23);
  });

  it("handles exact day-of-birthday correctly", () => {
    const birth = new Date("2000-06-15");
    const ref = new Date("2024-06-15");
    expect(calcAge(birth, ref)).toBe(24);
  });

  it("handles day before birthday", () => {
    const birth = new Date("2000-06-15");
    const ref = new Date("2024-06-14");
    expect(calcAge(birth, ref)).toBe(23);
  });

  it("handles leap-year birth date (Feb 29)", () => {
    const birth = new Date("2000-02-29");
    const ref = new Date("2024-02-28");
    expect(calcAge(birth, ref)).toBe(23);
  });

  it("handles leap-year birthday on the day itself (Mar 1 considered post-birthday in non-leap year)", () => {
    const birth = new Date("2000-02-29");
    const ref = new Date("2024-03-01");
    expect(calcAge(birth, ref)).toBe(24);
  });
});

describe("isUnder18", () => {
  it("returns true for a 17-year-old before birthday", () => {
    const birth = new Date("2007-08-15");
    const ref = new Date("2024-06-21");
    expect(isUnder18(birth, ref)).toBe(true);
  });

  it("returns false for someone who just turned 18", () => {
    const birth = new Date("2006-06-20");
    const ref = new Date("2024-06-21");
    expect(isUnder18(birth, ref)).toBe(false);
  });

  it("returns false exactly 18 years later to the day", () => {
    const birth = new Date("2006-06-21");
    const ref = new Date("2024-06-21");
    expect(isUnder18(birth, ref)).toBe(false);
  });

  it("returns true for a baby", () => {
    const birth = new Date("2024-01-01");
    const ref = new Date("2024-06-21");
    expect(isUnder18(birth, ref)).toBe(true);
  });

  it("returns false for a 30-year-old adult", () => {
    const birth = new Date("1994-01-01");
    const ref = new Date("2024-06-21");
    expect(isUnder18(birth, ref)).toBe(false);
  });

  it("handles timezone edge case (UTC midnight birth treated as local)", () => {
    const birth = new Date("2006-06-21T00:00:00Z");
    const ref = new Date("2024-06-21T23:59:59Z");
    expect(isUnder18(birth, ref)).toBe(false);
  });
});

describe("getTurnStatus", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  it("returns 'past' when isActive is false", () => {
    expect(getTurnStatus(0, 30, future, false)).toBe("past");
  });

  it("returns 'past' when endDate is in the past", () => {
    expect(getTurnStatus(0, 30, past, true)).toBe("past");
  });

  it("returns 'full' when booked equals capacity", () => {
    expect(getTurnStatus(30, 30, future, true)).toBe("full");
  });

  it("returns 'full' when booked exceeds capacity (defensive)", () => {
    expect(getTurnStatus(35, 30, future, true)).toBe("full");
  });

  it("returns 'few' when booked is at 80% of capacity", () => {
    expect(getTurnStatus(24, 30, future, true)).toBe("few");
  });

  it("returns 'few' when booked is between 80% and 100%", () => {
    expect(getTurnStatus(27, 30, future, true)).toBe("few");
  });

  it("returns 'available' when booked is below 80%", () => {
    expect(getTurnStatus(10, 30, future, true)).toBe("available");
  });

  it("returns 'available' when no bookings", () => {
    expect(getTurnStatus(0, 30, future, true)).toBe("available");
  });

  it("handles zero capacity (full at 0 bookings)", () => {
    expect(getTurnStatus(0, 0, future, true)).toBe("full");
  });
});

describe("fmtDate", () => {
  it("formats in Italian by default", () => {
    const d = new Date("2024-06-21T12:00:00Z");
    const out = fmtDate(d);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("formats with explicit 'en' locale", () => {
    const d = new Date("2024-06-21T12:00:00Z");
    const out = fmtDate(d, "en");
    expect(out).toMatch(/2024/);
  });

  it("formats with explicit 'it' locale", () => {
    const d = new Date("2024-06-21T12:00:00Z");
    const out = fmtDate(d, "it");
    expect(out).toMatch(/2024/);
  });

  it("returns a string for any valid Date", () => {
    expect(typeof fmtDate(new Date(), "it")).toBe("string");
  });
});
