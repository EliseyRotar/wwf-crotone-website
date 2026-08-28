/**
 * Thin env module for Node scripts (src/lib/status-poll.js, etc.).
 * Scripts run OUTSIDE Next.js, so they can't import the T3 Env server
 * schema (it pulls in `next/headers` via the T3 Env core).
 *
 * We re-declare just the script-relevant vars with a tiny zod parse
 * at startup. Each script that needs config should call
 * `loadScriptEnv()` once at the top and destructure.
 *
 * Used by:
 *   - scripts/status-poll.js     (UPTIMEROBOT_API_KEY, SELF_HEALTH_URL, R2_*)
 *   - scripts/r2-quota-check.js  (AWS_*)
 *   - scripts/sentry-smoke-test.js
 *   - scripts/uptimerobot-fix.js (UPTIMEROBOT_API_KEY)
 *   - scripts/backup-db.cjs      (DATABASE_URL)
 *   - scripts/migrate-gallery-to-r2.mjs (R2_*, DATABASE_URL)
 */

import { z } from "zod";

const ScriptEnvSchema = z.object({
  // Core — every script needs the DB
  DATABASE_URL: z.string().url(),

  // R2 — most scripts touch it
  AWS_ENDPOINT: z.string().url().optional(),
  AWS_REGION: z.string().default("auto"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default("wwf-backups"),

  // Status page cron
  UPTIMEROBOT_API_KEY: z.string().optional(),
  SELF_HEALTH_URL: z.string().url().default("http://app:3000/api/health"),

  // Sentry smoke test
  SENTRY_DSN: z.string().url().optional(),

  // Backup script
  WALG_S3_PREFIX: z.string().default("s3://wwf-backups"),

  // For local dev, allow opting out
  SKIP_ENV_VALIDATION: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true")
});

export type ScriptEnv = z.infer<typeof ScriptEnvSchema>;

/**
 * Load + validate env for a Node script. Call at the top of the entry point.
 *
 * Throws on any missing-required field. Caches the parsed object so
 * subsequent calls are O(1).
 */
let cached: ScriptEnv | null = null;
export function loadScriptEnv(): ScriptEnv {
  if (cached) return cached;
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    // Dev escape hatch — accept whatever's there, no validation.
    cached = process.env as unknown as ScriptEnv;
    return cached;
  }
  const parsed = ScriptEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment for script:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Script env validation failed");
  }
  cached = parsed.data;
  return cached;
}
