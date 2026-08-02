import { describe, it, expect } from "vitest";
import { signLookupToken, verifyLookupToken } from "@/lib/lookupToken";

describe("signLookupToken / verifyLookupToken", () => {
  it("round-trips a valid id", () => {
    const token = signLookupToken("isc_123");
    expect(verifyLookupToken(token)).toBe("isc_123");
  });

  it("returns null for an empty token", () => {
    expect(verifyLookupToken("")).toBeNull();
  });

  it("returns null for a token with the wrong HMAC", () => {
    const token = signLookupToken("isc_123");
    const tampered = token.slice(0, -3) + "AAA";
    expect(verifyLookupToken(tampered)).toBeNull();
  });

  it("returns null for a token with a tampered id", () => {
    const token = signLookupToken("isc_123");
    const [id, expiry, sig] = token.split(".");
    const swapped = `isc_999.${expiry}.${sig}`;
    expect(verifyLookupToken(swapped)).toBeNull();
  });

  it("returns null for a malformed token (not enough parts)", () => {
    expect(verifyLookupToken("abc.def")).toBeNull();
    expect(verifyLookupToken("abc")).toBeNull();
  });

  it("returns null for a non-string token", () => {
    // @ts-expect-error testing runtime defensiveness
    expect(verifyLookupToken(null)).toBeNull();
    // @ts-expect-error testing runtime defensiveness
    expect(verifyLookupToken(undefined)).toBeNull();
  });
});
