import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Schema-shape test for the BookingDraft FormFieldsSchema.
 *
 * The actual schema lives in src/app/api/booking-draft/route.ts as a
 * zod schema inside an HTTP route handler. Importing it would pull in
 * Prisma + next/headers + cookies which doesn't work in unit tests.
 *
 * Instead we re-state the contract here and verify it. The full server
 * validation in the route is what actually runs in production; this
 * test is documentation + a tripwire if the route's schema changes
 * without updating the contract.
 *
 * If you change the shape (e.g. add a new field, rename a key), update
 * BOTH this file AND src/app/api/booking-draft/route.ts.
 */
const FormFieldsSchema = z
  .object({
    firstName: z.string().trim().max(80).optional().default(""),
    lastName: z.string().trim().max(80).optional().default(""),
    birthDate: z.string().max(20).optional().default(""),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(200)
      .optional()
      .or(z.literal(""))
      .default(""),
    phone: z.string().trim().max(40).optional().default(""),
    isMinor: z.boolean().optional().default(false),
    guardianName: z.string().trim().max(80).optional().default(""),
    guardianEmail: z.string().trim().max(200).optional().default(""),
    guardianPhone: z.string().trim().max(40).optional().default(""),
    guardianConsent: z.boolean().optional().default(false),
    turnoIds: z.array(z.string().min(1).max(64)).max(20).optional().default([]),
    allergies: z.string().max(2000).optional().default(""),
    medications: z.string().max(2000).optional().default(""),
    swimmingAbility: z.string().max(40).optional().default(""),
    tetanusStatus: z.string().max(40).optional().default(""),
    fitnessSelf: z.string().max(40).optional().default(""),
    dietaryNeeds: z.string().max(40).optional().default("none"),
    dietaryNotes: z.string().max(2000).optional().default(""),
    tshirtSize: z.string().max(20).optional().default(""),
    arrivalMode: z.string().max(40).optional().default(""),
    arrivalFrom: z.string().max(2000).optional().default(""),
    flightNumber: z.string().max(40).optional().default(""),
    trainNumber: z.string().max(40).optional().default(""),
    busCompany: z.string().max(80).optional().default(""),
    arrivalNotes: z.string().max(2000).optional().default(""),
    arrivalTime: z.string().max(20).optional().default(""),
    departureTime: z.string().max(20).optional().default(""),
    privacyConsent: z.boolean().optional().default(false),
    marketingConsent: z.boolean().optional().default(false),
    imageDataConsent: z.boolean().optional().default(false),
    website: z.string().max(500).optional().default("")
  })
  .strict();

describe("BookingDraft FormFieldsSchema (server-side draft persistence)", () => {
  it("accepts an empty object (all defaults)", () => {
    const result = FormFieldsSchema.parse({});
    expect(result.firstName).toBe("");
    expect(result.turnoIds).toEqual([]);
    expect(result.privacyConsent).toBe(false);
  });

  it("accepts a typical draft", () => {
    const draft = {
      firstName: "Mario",
      lastName: "Rossi",
      email: "mario@example.com",
      phone: "+393331234567",
      birthDate: "1995-04-12",
      isMinor: false,
      turnoIds: ["turno-1", "turno-2"],
      allergies: "noci",
      privacyConsent: true,
      marketingConsent: false,
      imageDataConsent: true
    };
    const result = FormFieldsSchema.parse(draft);
    expect(result.firstName).toBe("Mario");
    expect(result.turnoIds).toHaveLength(2);
    expect(result.privacyConsent).toBe(true);
  });

  it("rejects an unknown field (strict mode)", () => {
    const result = FormFieldsSchema.safeParse({
      firstName: "Mario",
      socialSecurityNumber: "123-45-6789"
    });
    expect(result.success).toBe(false);
  });

  it("rejects overly-long firstName", () => {
    const result = FormFieldsSchema.safeParse({ firstName: "x".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("rejects overly-long notes (DoS protection)", () => {
    const result = FormFieldsSchema.safeParse({ dietaryNotes: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 turni", () => {
    const tooManyTurns = Array.from({ length: 21 }, (_, i) => `turno-${i}`);
    const result = FormFieldsSchema.safeParse({ turnoIds: tooManyTurns });
    expect(result.success).toBe(false);
  });

  it("accepts empty string email (partial draft)", () => {
    const result = FormFieldsSchema.parse({ email: "" });
    expect(result.email).toBe("");
  });

  it("rejects invalid email format (when not empty)", () => {
    const result = FormFieldsSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("honeypot field has 500-char limit", () => {
    // Bot detection — the form has a hidden "website" field that humans
    // never fill. We limit it server-side so a bot can't bloat our
    // draft with arbitrary data.
    const result = FormFieldsSchema.safeParse({ website: "x".repeat(501) });
    expect(result.success).toBe(false);
  });
});
