import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for src/lib/bookings.ts.
 *
 * The helper is the single source of truth for "show all my
 * bookings" — both the bookings list page and the API route depend on
 * it. We mock the Prisma client so we can exercise the dedupe + email
 * matching logic without spinning up a real DB.
 */

type IscrizioneRow = {
  id: string;
  email: string;
  deletedAt: Date | null;
  createdAt: Date;
};

const findFirstMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    iscrizione: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args)
    }
  }
}));

const { findBookingsForVolunteer } = await import("@/lib/bookings");

beforeEach(() => {
  findFirstMock.mockReset();
  findManyMock.mockReset();
});

describe("findBookingsForVolunteer — ownership lookup", () => {
  it("falls back to the session's iscrizioneId when no other row matches the email", async () => {
    const primary: IscrizioneRow = {
      id: "isc-1",
      email: "alice@example.com",
      deletedAt: null,
      createdAt: new Date("2026-01-01")
    };
    findFirstMock.mockResolvedValueOnce(primary);
    findManyMock.mockResolvedValueOnce([
      { ...primary, turno: { id: "t1", number: 1, startDate: new Date(), endDate: new Date() }, iscrizioneTurni: [] }
    ]);

    const result = await findBookingsForVolunteer({
      iscrizioneId: "isc-1",
      email: "alice@example.com"
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("isc-1");
  });

  it("dedupes when both the id and the email clauses match the same row", async () => {
    const primary: IscrizioneRow = {
      id: "isc-1",
      email: "alice@example.com",
      deletedAt: null,
      createdAt: new Date("2026-01-01")
    };
    findFirstMock.mockResolvedValueOnce(primary);
    // Both branches in the findMany "OR" would return isc-1 once.
    findManyMock.mockResolvedValueOnce([
      { ...primary, turno: { id: "t1", number: 1, startDate: new Date(), endDate: new Date() }, iscrizioneTurni: [] },
      { ...primary, turno: { id: "t1", number: 1, startDate: new Date(), endDate: new Date() }, iscrizioneTurni: [] }
    ]);

    const result = await findBookingsForVolunteer({
      iscrizioneId: "isc-1",
      email: "alice@example.com"
    });
    expect(result).toHaveLength(1);
  });

  it("returns all bookings for the same email (multi-turn volunteer)", async () => {
    const primary: IscrizioneRow = {
      id: "isc-1",
      email: "alice@example.com",
      deletedAt: null,
      createdAt: new Date("2026-01-01")
    };
    findFirstMock.mockResolvedValueOnce(primary);
    findManyMock.mockResolvedValueOnce([
      { id: "isc-1", email: "alice@example.com", deletedAt: null, createdAt: new Date("2026-01-01"), turno: { id: "t1", number: 1, startDate: new Date(), endDate: new Date() }, iscrizioneTurni: [] },
      { id: "isc-2", email: "alice@example.com", deletedAt: null, createdAt: new Date("2026-02-01"), turno: { id: "t3", number: 3, startDate: new Date(), endDate: new Date() }, iscrizioneTurni: [] }
    ]);

    const result = await findBookingsForVolunteer({
      iscrizioneId: "isc-1",
      email: "alice@example.com"
    });
    expect(result.map((r) => r.id).sort()).toEqual(["isc-1", "isc-2"]);
  });

  it("uses the email from the DB row (not the cookie) when the cookie email is stale", async () => {
    // Volunteer changed their email between sessions. The session
    // still carries the old address, but the DB row has been
    // updated. We trust the DB email.
    const primary: IscrizioneRow = {
      id: "isc-1",
      email: "alice-new@example.com",
      deletedAt: null,
      createdAt: new Date("2026-01-01")
    };
    findFirstMock.mockResolvedValueOnce(primary);
    findManyMock.mockResolvedValueOnce([
      { ...primary, turno: { id: "t1", number: 1, startDate: new Date(), endDate: new Date() }, iscrizioneTurni: [] }
    ]);

    await findBookingsForVolunteer({
      iscrizioneId: "isc-1",
      email: "alice-old@example.com"
    });

    // The findMany call must have used the DB email (lower-cased).
    const call = findManyMock.mock.calls[0]?.[0] as
      | { where: { OR: Array<Record<string, unknown>> } }
      | undefined;
    expect(call).toBeDefined();
    const orClauses = call!.where.OR;
    const hasNewEmail = orClauses.some(
      (c) => typeof c.email === "string" && c.email.toLowerCase() === "alice-new@example.com"
    );
    expect(hasNewEmail).toBe(true);
  });
});
