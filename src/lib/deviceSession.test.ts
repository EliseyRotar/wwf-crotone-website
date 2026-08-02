import { describe, it, expect, beforeEach } from "vitest";
import {
  mintDeviceCookie,
  verifyDeviceCookie,
  deviceHashFor,
  DEVICE_TTL_MS
} from "@/lib/deviceSession";

describe("deviceSession", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-must-be-at-least-32-chars-long-xx";
  });

  describe("deviceHashFor", () => {
    it("is deterministic for the same UA + acceptLanguage", () => {
      const a = deviceHashFor("ua-a", "it-IT,it");
      const b = deviceHashFor("ua-a", "it-IT,it");
      expect(a).toBe(b);
    });

    it("differs when UA changes", () => {
      const a = deviceHashFor("ua-a", "it-IT,it");
      const b = deviceHashFor("ua-b", "it-IT,it");
      expect(a).not.toBe(b);
    });

    it("differs when accept-language changes", () => {
      const a = deviceHashFor("ua-a", "it-IT,it");
      const b = deviceHashFor("ua-a", "en-US,en");
      expect(a).not.toBe(b);
    });

    it("handles empty strings without throwing", () => {
      expect(() => deviceHashFor("", "")).not.toThrow();
      expect(() => deviceHashFor("", "")).toBeTruthy();
    });
  });

  describe("mintDeviceCookie / verifyDeviceCookie round trip", () => {
    it("verifies a fresh cookie from the same UA + lang", () => {
      const minted = mintDeviceCookie({
        userId: "u-1",
        ua: "Mozilla/5.0",
        acceptLanguage: "it-IT,it"
      });
      const result = verifyDeviceCookie(minted.value, "Mozilla/5.0", "it-IT,it");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.userId).toBe("u-1");
        expect(result.deviceHash).toBe(minted.deviceHash);
        expect(result.expiresAtMs).toBe(minted.expiresAt.getTime());
      }
    });

    it("rejects a cookie from a different UA (device-mismatch)", () => {
      const minted = mintDeviceCookie({
        userId: "u-1",
        ua: "Mozilla/5.0",
        acceptLanguage: "it-IT,it"
      });
      const result = verifyDeviceCookie(minted.value, "OtherBrowser/1.0", "it-IT,it");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("device-mismatch");
    });

    it("rejects a cookie from a different accept-language", () => {
      const minted = mintDeviceCookie({
        userId: "u-1",
        ua: "Mozilla/5.0",
        acceptLanguage: "it-IT,it"
      });
      const result = verifyDeviceCookie(minted.value, "Mozilla/5.0", "en-US,en");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("device-mismatch");
    });

    it("rejects a tampered userId", () => {
      const minted = mintDeviceCookie({
        userId: "u-1",
        ua: "Mozilla/5.0",
        acceptLanguage: "it-IT,it"
      });
      // Tamper the encoded userId segment
      const parts = minted.value.split(".");
      const swapped = `diFferent.${parts[1]}.${parts[2]}.${parts[3]}`;
      const result = verifyDeviceCookie(swapped, "Mozilla/5.0", "it-IT,it");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(["bad-signature", "malformed"]).toContain(result.reason);
    });

    it("rejects an expired cookie", () => {
      const expiredAt = Date.now() - 1000;
      const minted = mintDeviceCookie({
        userId: "u-1",
        ua: "Mozilla/5.0",
        acceptLanguage: "it-IT,it",
        expiresAtMs: expiredAt
      });
      const result = verifyDeviceCookie(minted.value, "Mozilla/5.0", "it-IT,it");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("expired");
    });

    it("rejects a malformed cookie (wrong number of parts)", () => {
      const result = verifyDeviceCookie("only.two.parts", "ua", "al");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("malformed");
    });

    it("rejects undefined / null / non-string", () => {
      expect(verifyDeviceCookie(undefined, "ua", "al").ok).toBe(false);
      expect(verifyDeviceCookie(null, "ua", "al").ok).toBe(false);
      // @ts-expect-error runtime defensiveness
      expect(verifyDeviceCookie(12345, "ua", "al").ok).toBe(false);
    });

    it("rejects a tampered HMAC", () => {
      const minted = mintDeviceCookie({
        userId: "u-1",
        ua: "Mozilla/5.0",
        acceptLanguage: "it-IT,it"
      });
      // Flip a byte in the HMAC
      const parts = minted.value.split(".");
      const sig = parts[3];
      const flipped =
        sig.slice(0, 1) === "A" ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
      const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${flipped}`;
      const result = verifyDeviceCookie(tampered, "Mozilla/5.0", "it-IT,it");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad-signature");
    });

    it("DEVICE_TTL_MS is 30 days", () => {
      expect(DEVICE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });
});
