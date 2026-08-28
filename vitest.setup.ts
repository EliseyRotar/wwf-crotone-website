/**
 * Vitest global setup — sets the env vars required at module-load time
 * before any test imports a module that reads process.env at import time.
 *
 * AUTH_SECRET must be a real (>=32 char) value or the strict checks in
 * src/lib/auth.ts will throw at import time. The other modules that read
 * env (DATABASE_URL, SMTP_*, R2_*, etc.) are only loaded in integration
 * tests; we skip the strict checks for them here.
 */

(process.env as Record<string, string | undefined>).AUTH_SECRET =
  process.env.AUTH_SECRET || "test-secret-must-be-at-least-32-chars-long-xx";
(process.env as Record<string, string | undefined>).NODE_ENV =
  process.env.NODE_ENV || "test";
