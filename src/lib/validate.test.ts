import { describe, it, expect } from "vitest";
import { validateLength, validateEmail, sanitizeHtml, LIMITS } from "@/lib/validate";

describe("validateLength", () => {
  it("returns true for non-string values (defensive)", () => {
    expect(validateLength(123, 10)).toBe(true);
    expect(validateLength(null, 10)).toBe(true);
    expect(validateLength(undefined, 10)).toBe(true);
    expect(validateLength({}, 10)).toBe(true);
    expect(validateLength([], 10)).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(validateLength("", 10)).toBe(true);
  });

  it("returns true when string is exactly at max length", () => {
    expect(validateLength("a".repeat(10), 10)).toBe(true);
  });

  it("returns true when string is below max length", () => {
    expect(validateLength("abc", 10)).toBe(true);
  });

  it("returns false when string exceeds max length", () => {
    expect(validateLength("a".repeat(11), 10)).toBe(false);
  });

  it("handles unicode characters (length is JS string length, not byte count)", () => {
    // JS string length counts UTF-16 code units. Each emoji takes 2 code units.
    const emoji = "🎉".repeat(5); // length === 10
    expect(emoji.length).toBe(10);
    expect(validateLength(emoji, 10)).toBe(true);
    expect(validateLength(emoji + "x", 10)).toBe(false);
    // Plain ASCII still works at exact bound
    expect(validateLength("hello", 5)).toBe(true);
    expect(validateLength("helloo", 5)).toBe(false);
  });
});

describe("validateEmail", () => {
  it("accepts a normal email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(validateEmail("user@mail.example.co.uk")).toBe(true);
  });

  it("accepts email with plus tag", () => {
    expect(validateEmail("user+tag@example.com")).toBe(true);
  });

  it("accepts email with dots in local part", () => {
    expect(validateEmail("first.last@example.com")).toBe(true);
  });

  it("rejects email without @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  it("rejects email without domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  it("rejects email without local part", () => {
    expect(validateEmail("@example.com")).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(validateEmail("user @example.com")).toBe(false);
    expect(validateEmail("user@exa mple.com")).toBe(false);
  });

  it("rejects email without TLD dot", () => {
    expect(validateEmail("user@example")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(validateEmail(123)).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail({})).toBe(false);
    expect(validateEmail([])).toBe(false);
  });

  it("rejects email exceeding max length", () => {
    const long = "a".repeat(LIMITS.MAX_EMAIL) + "@x.com";
    expect(validateEmail(long)).toBe(false);
  });

  it("accepts email at max length", () => {
    const local = "a".repeat(LIMITS.MAX_EMAIL - 7);
    expect(validateEmail(`${local}@x.co`)).toBe(true);
  });
});

describe("sanitizeHtml", () => {
  describe("XSS payloads", () => {
    it("strips <script> tags and their content", () => {
      const dirty = '<p>hi</p><script>alert("xss")</script>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("alert");
      expect(clean).toContain("<p>hi</p>");
    });

    it("strips inline event handlers (onclick, onerror)", () => {
      const dirty = '<p onclick="alert(1)">click</p><img src="x" onerror="alert(1)">';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("onclick");
      expect(clean).not.toContain("onerror");
    });

    it("blocks javascript: scheme on links", () => {
      const dirty = '<a href="javascript:alert(1)">click</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toMatch(/javascript:/i);
    });

    it("blocks javascript: scheme (mixed case)", () => {
      const dirty = '<a href="JaVaScRiPt:alert(1)">x</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean.toLowerCase()).not.toContain("javascript:");
    });

    it("blocks data: scheme on links (only allowed on img)", () => {
      const dirty = '<a href="data:text/html,<script>alert(1)</script>">x</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toMatch(/data:text\/html/i);
    });

    it("strips <iframe>", () => {
      const dirty = '<iframe src="https://evil.example"></iframe>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<iframe");
    });

    it("strips <object> and <embed>", () => {
      const dirty = '<object data="evil"></object><embed src="evil">';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<object");
      expect(clean).not.toContain("<embed");
    });

    it("strips SVG with onload", () => {
      const dirty = '<svg onload="alert(1)"></svg>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toMatch(/<svg/i);
      expect(clean).not.toContain("onload");
    });

    it("strips <style> and <link>", () => {
      const dirty = '<style>body{background:url("javascript:alert(1)")}</style><link rel="stylesheet" href="evil">';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<style");
      expect(clean).not.toContain("<link");
    });

    it("strips form elements", () => {
      const dirty = '<form action="/x"><input name="x"><button>x</button></form>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<form");
      expect(clean).not.toContain("<input");
      expect(clean).not.toContain("<button");
    });

    it("forces rel=noopener noreferrer and target on anchors", () => {
      const dirty = '<a href="https://example.com" target="_blank">x</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain('rel="noopener noreferrer"');
      expect(clean).toContain('target="_blank"');
    });

    it("discards unknown tags (disallowedTagsMode=discard)", () => {
      const dirty = "<custom-tag>x</custom-tag>";
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<custom-tag");
    });
  });

  describe("allowed content", () => {
    it("preserves safe headings and paragraphs", () => {
      const dirty = "<h1>Title</h1><p>Body <strong>bold</strong></p>";
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain("<h1>Title</h1>");
      expect(clean).toContain("<strong>bold</strong>");
    });

    it("preserves lists", () => {
      const dirty = "<ul><li>one</li><li>two</li></ul>";
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain("<ul>");
      expect(clean).toContain("<li>one</li>");
    });

    it("preserves images with https and data src", () => {
      const dirty = '<img src="https://x/y.png" alt="y"><img src="data:image/png;base64,AAAA" alt="z">';
      const clean = sanitizeHtml(dirty);
      expect(clean).toMatch(/<img/);
    });

    it("preserves https links", () => {
      const dirty = '<a href="https://example.com">x</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain('href="https://example.com"');
    });

    it("preserves mailto links", () => {
      const dirty = '<a href="mailto:a@b.com">x</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain("mailto:");
    });
  });

  it("handles empty/null input without throwing", () => {
    expect(sanitizeHtml("")).toBe("");
    // The function uses `?? ""` so null/undefined coerce to ""
    expect(sanitizeHtml(null as unknown as string)).toBe("");
    expect(sanitizeHtml(undefined as unknown as string)).toBe("");
  });
});
