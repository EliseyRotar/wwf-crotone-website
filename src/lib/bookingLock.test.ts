import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  lockReasonFor,
  canEditAnything,
  PERSONAL_DATA_FIELDS,
  EDITABLE_FIELDS,
  FIELD_LABELS
} from "@/lib/bookingLock";

/**
 * Unit tests for the booking editability helpers in src/lib/bookingLock.ts.
 *
 * The personal area's edit form (and the API route behind it) both
 * rely on `lockReasonFor` to decide whether to render an input as
 * disabled and whether to refuse a write. These tests pin down:
 *   - the "turno started" lock applies to ALL fields, not just
 *     personal data;
 *   - the "personal data locked" lock applies ONLY to the personal
 *     identity + consent fields;
 *   - when neither lock is set every editable field is open.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-15T12:00:00Z")); // 5 weeks before camp start
});

afterEach(() => {
  vi.useRealTimers();
});

const baseIscrizione = {
  personalDataLockedAt: null as Date | null,
  turno: { startDate: new Date("2026-06-21") } // camp starts in ~5 weeks
};

describe("lockReasonFor — no locks set", () => {
  const iscrizione = { ...baseIscrizione };

  it("returns null for personal fields when nothing is locked", () => {
    expect(lockReasonFor("firstName", iscrizione)).toBeNull();
    expect(lockReasonFor("email", iscrizione)).toBeNull();
    expect(lockReasonFor("privacyConsent", iscrizione)).toBeNull();
  });

  it("returns null for health fields when nothing is locked", () => {
    expect(lockReasonFor("allergies", iscrizione)).toBeNull();
    expect(lockReasonFor("swimmingAbility", iscrizione)).toBeNull();
  });

  it("returns null for logistics fields when nothing is locked", () => {
    expect(lockReasonFor("arrivalMode", iscrizione)).toBeNull();
    expect(lockReasonFor("departureTime", iscrizione)).toBeNull();
  });

  it("returns null for unknown field names (defensive)", () => {
    expect(lockReasonFor("totallyMadeUpField", iscrizione)).toBeNull();
  });
});

describe("lockReasonFor — personal data locked", () => {
  const iscrizione = { ...baseIscrizione, personalDataLockedAt: new Date("2026-04-01") };

  it.each(PERSONAL_DATA_FIELDS)("locks the personal field %s", (f) => {
    expect(lockReasonFor(f, iscrizione)).toBe("personal-data-locked");
  });

  it("does NOT lock health fields (allergies)", () => {
    expect(lockReasonFor("allergies", iscrizione)).toBeNull();
  });

  it("does NOT lock logistics fields (arrivalTime)", () => {
    expect(lockReasonFor("arrivalTime", iscrizione)).toBeNull();
  });

  it("does NOT lock the dieta fields", () => {
    expect(lockReasonFor("dietaryNeeds", iscrizione)).toBeNull();
    expect(lockReasonFor("dietaryNotes", iscrizione)).toBeNull();
  });

  it("locks the consent block (privacyConsent / marketingConsent / imageDataConsent)", () => {
    expect(lockReasonFor("privacyConsent", iscrizione)).toBe("personal-data-locked");
    expect(lockReasonFor("marketingConsent", iscrizione)).toBe("personal-data-locked");
    expect(lockReasonFor("imageDataConsent", iscrizione)).toBe("personal-data-locked");
  });
});

describe("lockReasonFor — turno started", () => {
  // System time is 2026-05-15; turno started on 2026-06-21 in baseIscrizione.
  // Move the system clock past the start so the lock engages.
  const iscrizione = { ...baseIscrizione };
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-06-22T09:00:00Z"));
  });

  it("locks EVERY editable field once the turno has started", () => {
    for (const f of EDITABLE_FIELDS) {
      expect(lockReasonFor(f, iscrizione)).toBe("turno-started");
    }
  });

  it("locks personal data fields even when personalDataLockedAt is NOT set", () => {
    expect(lockReasonFor("firstName", iscrizione)).toBe("turno-started");
  });

  it("prefers 'turno-started' over 'personal-data-locked' when both apply", () => {
    const both = { ...baseIscrizione, personalDataLockedAt: new Date("2026-04-01") };
    expect(lockReasonFor("firstName", both)).toBe("turno-started");
  });
});

describe("canEditAnything", () => {
  it("returns true when no lock applies", () => {
    expect(canEditAnything(baseIscrizione)).toBe(true);
  });

  it("returns true when only personalDataLockedAt is set (logistics still editable)", () => {
    const iscrizione = { ...baseIscrizione, personalDataLockedAt: new Date() };
    expect(canEditAnything(iscrizione)).toBe(true);
  });

  it("returns false once the turno has started", () => {
    vi.setSystemTime(new Date("2026-06-22T09:00:00Z"));
    expect(canEditAnything(baseIscrizione)).toBe(false);
  });
});

describe("EDITABLE_FIELDS and FIELD_LABELS stay in sync", () => {
  it("every field in EDITABLE_FIELDS has a section in FIELD_LABELS", () => {
    for (const f of EDITABLE_FIELDS) {
      expect(FIELD_LABELS[f], `missing FIELD_LABELS entry for ${f}`).toBeDefined();
      const section = FIELD_LABELS[f]?.section;
      expect(["anagrafica", "salute", "logistica", "consensi"]).toContain(section);
    }
  });

  it("PERSONAL_DATA_FIELDS is a subset of EDITABLE_FIELDS", () => {
    for (const f of PERSONAL_DATA_FIELDS) {
      expect(EDITABLE_FIELDS).toContain(f);
    }
  });
});
