/**
 * CommonJS env validator for Node scripts (status-poll.js, r2-quota-check.js, etc.).
 *
 * These scripts run OUTSIDE Next.js, so they can't import from
 * @/env/server (which pulls in T3 Env + zod + next/headers transitively).
 *
 * This is a minimal CommonJS port of src/env/scripts.ts. Keep the two
 * in sync when adding new env vars.
 *
 * Usage:
 *   const { loadScriptEnv } = require("./env-script.cjs");
 *   const env = loadScriptEnv();
 *   console.log(env.UPTIMEROBOT_API_KEY);
 */

const { z } = require("zod");

const ScriptEnvSchema = z.object({
  DATABASE_URL: z.string().url(),

  AWS_ENDPOINT: z.string().url().optional(),
  AWS_REGION: z.string().default("auto"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default("wwf-backups"),

  UPTIMEROBOT_API_KEY: z.string().optional(),
  SELF_HEALTH_URL: z.string().url().default("http://app:3000/api/health"),

  SENTRY_DSN: z.string().url().optional(),

  WALG_S3_PREFIX: z.string().default("s3://wwf-backups"),

  SKIP_ENV_VALIDATION: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true")
});

let cached = null;

function loadScriptEnv() {
  if (cached) return cached;
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    cached = process.env;
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

module.exports = { loadScriptEnv };
