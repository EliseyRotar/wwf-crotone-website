import sanitizeHtmlLib from "sanitize-html";

const MAX_STRING = 2000;
const MAX_EMAIL = 200;
const MAX_NAME = 80;
const MAX_PHONE = 40;
const MAX_NOTES = 5000;
const MAX_BLOG_CONTENT = 100_000;
const MAX_BULK_EMAIL_BODY = 50_000;
const MAX_BULK_EMAIL_SUBJECT = 200;

export function validateLength(value: unknown, max: number): boolean {
  if (typeof value !== "string") return true;
  return value.length <= max;
}

export function validateEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  return email.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const LIMITS = {
  MAX_STRING,
  MAX_EMAIL,
  MAX_NAME,
  MAX_PHONE,
  MAX_NOTES,
  MAX_BLOG_CONTENT,
  MAX_BULK_EMAIL_BODY,
  MAX_BULK_EMAIL_SUBJECT,
} as const;

const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "strong", "em", "b", "i", "u", "s",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div"
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": ["class", "id"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"]
  },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        rel: "noopener noreferrer",
        target: attribs.target === "_blank" ? "_blank" : "_self"
      }
    })
  }
};

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty ?? "", SANITIZE_OPTIONS);
}
