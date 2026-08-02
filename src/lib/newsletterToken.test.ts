import { describe, it, expect } from "vitest";
import { signNewsletterToken, verifyNewsletterToken } from "@/lib/newsletterToken";

describe("signNewsletterToken / verifyNewsletterToken", () => {
  it("round-trips a valid email", () => {
    const token = signNewsletterToken("foo@example.com");
    expect(verifyNewsletterToken(token)).toBe("foo@example.com");
  });

  it("normalises the email to lowercase", () => {
    const token = signNewsletterToken("Foo@Example.com");
    expect(verifyNewsletterToken(token)).toBe("foo@example.com");
  });

  it("returns null for an empty token", () => {
    expect(verifyNewsletterToken("")).toBeNull();
  });

  it("returns null for a forged HMAC", () => {
    const token = signNewsletterToken("foo@example.com");
    const tampered = token.slice(0, -3) + "AAA";
    expect(verifyNewsletterToken(tampered)).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(verifyNewsletterToken("a.b")).toBeNull();
  });

  it("returns null for an email-shaped string without an '@'", () => {
    const token = signNewsletterToken("not-an-email");
    expect(verifyNewsletterToken(token)).toBeNull();
  });
});
