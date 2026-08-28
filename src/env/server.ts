/**
 * Server-side env validation via @t3-oss/env-nextjs.
 *
 * Validates ALL env vars at app boot (server-only context). Throws
 * loudly if anything is missing/invalid — fails fast instead of
 * crashing on first use.
 *
 * Convention:
 *   import { serverEnv } from "@/env/server"
 *   serverEnv.AUTH_SECRET    // typed `string`
 *   serverEnv.SMTP_HOST      // typed `string` (defaulted)
 *   serverEnv.UPSTASH_*      // optional, may be undefined
 *
 * Server-only env vars are NEVER exposed to the client bundle — the
 * @t3-oss/env-nextjs Proxy throws if you try to read them from a
 * client component. This is the whole point.
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const serverEnv = createEnv({
  server: {
    // ─── Auth ──────────────────────────────────────────────────────────
    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET must be at least 32 characters — generate with: openssl rand -base64 48"),
    LOOKUP_ADMIN_TOKEN: z.string().min(16).optional(),

    // ─── Database ──────────────────────────────────────────────────────
    DATABASE_URL: z.string().url(),

    // ─── SMTP (Gmail primary, Brevo in prod) ─────────────────────────
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_SECURE: z.coerce.boolean().default(true),
    SMTP_USER: z.string().email().optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
    USE_BREVO_EMAIL: z.coerce.boolean().default(false),
    BREVO_SMTP_KEY: z.string().min(1).optional(),
    ADMIN_NOTIFY_EMAIL: z.string().email().optional(),

    // ─── AI (Groq free tier) ──────────────────────────────────────────
    GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required for the chatbot"),

    // ─── R2 (receipts + gallery, same AWS_* creds, different buckets) ─
    AWS_ENDPOINT: z.string().url(),
    AWS_REGION: z.string().default("auto"),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    R2_RECEIPTS_BUCKET: z.string().default("wwf-receipts"),
    R2_GALLERY_BUCKET: z.string().default("wwf-gallery"),
    R2_GALLERY_PUBLIC_BASE: z.string().url().optional(),

    // ─── Sentry (server-side) ────────────────────────────────────────
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // ─── Redis (Upstash REST, optional) ─────────────────────────────
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

    // ─── MailHog / SMTP catcher for CI (optional) ────────────────────
    MAILPIT_URL: z.string().url().optional(),

    // ─── App config ───────────────────────────────────────────────────
    MAINTENANCE_MODE: z
      .union([z.literal("true"), z.literal("false"), z.literal("TRUE"), z.literal("FALSE"), z.boolean()])
      .default(false)
      .transform((v) => v === true || v === "true" || v === "TRUE"),
    TRUSTED_PROXY_HEADER: z.string().default("cf-connecting-ip"),
    INSTAGRAM_TOKEN: z.string().optional(),
    POSTGRES_PASSWORD: z.string().min(1),
    REDIS_URL: z.string().optional(), // local in-container redis

    // ─── Status page cron (scripts/status-poll.js) ────────────────────
    UPTIMEROBOT_API_KEY: z.string().optional(),
    SELF_HEALTH_URL: z.string().url().default("http://app:3000/api/health"),

    // ─── Node ──────────────────────────────────────────────────────────
    NODE_ENV: z.enum(["development", "test", "production"]).default("development")
  },

  // On the server, `process.env` is safe to pass directly. T3 Env reads
  // each key lazily.
  experimental__runtimeEnv: process.env,

  // Skip validation when running Next.js build (the build runs without
  // every env var — e.g. CI build doesn't have SMTP creds). Validation
  // runs at runtime.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  // Don't bail at build time if a var is missing. Empty strings are
  // fine for optional vars in dev.
  emptyStringAsUndefined: true
});

/**
 * Cross-field invariants that zod can't express declaratively.
 *
 * If `USE_BREVO_EMAIL=true` we need BREVO_SMTP_KEY. If false we
 * need SMTP_USER+SMTP_PASS for Gmail fallback.
 *
 * Warning-only in dev (so the dev server boots without SMTP),
 * throws in production.
 */
const isProd = process.env.NODE_ENV === "production";
if (serverEnv.USE_BREVO_EMAIL) {
  if (!serverEnv.BREVO_SMTP_KEY) {
    const msg = "USE_BREVO_EMAIL=true requires BREVO_SMTP_KEY";
    if (isProd) throw new Error(msg);
    else console.warn(`[env] ${msg}`);
  }
} else {
  if (!serverEnv.SMTP_USER || !serverEnv.SMTP_PASS) {
    const msg = "USE_BREVO_EMAIL=false requires SMTP_USER + SMTP_PASS (Gmail App Password)";
    if (isProd) throw new Error(msg);
    else console.warn(`[env] ${msg}`);
  }
}
