/**
 * Vitest global setup — sets the env vars required at module-load time
 * before any test imports a module that reads process.env at import time.
 *
 * T3 Env validates env at module-import. Each required field is set here
 * so the server schema in src/env/server.ts can parse without throwing.
 *
 * For tests, we don't need real values — just any syntactically valid
 * string/URL. The T3 Env validation is what we're testing (via the
 * booking-draft-schema test) and individual tests override what they
 * need.
 */

const E = process.env as Record<string, string | undefined>;

// Required for src/env/server.ts
E.AUTH_SECRET ||= "test-secret-must-be-at-least-32-chars-long-xx";
E.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
E.GROQ_API_KEY ||= "test-groq-key";
E.AWS_ENDPOINT ||= "https://test.r2.cloudflarestorage.com";
E.AWS_ACCESS_KEY_ID ||= "test-access-key";
E.AWS_SECRET_ACCESS_KEY ||= "test-secret-key";
E.POSTGRES_PASSWORD ||= "test-pg-password";
E.NEXT_PUBLIC_SITE_URL ||= "http://localhost:3000";

E.NODE_ENV ||= "test";
