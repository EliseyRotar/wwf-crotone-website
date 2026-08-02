/**
 * Rate limiting — dual-mode:
 *  - If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
 *    we delegate to @upstash/ratelimit (sliding window over Redis). This
 *    is the production path: shared, accurate, persisted.
 *  - Otherwise we fall back to an in-memory token bucket. This keeps
 *    local dev working without needing Redis. Not cluster-safe.
 *
 * The exported function is async to allow either backend; callers that
 * previously used the synchronous return value must `await` it.
 *
 * The `clientKey` helper intentionally does NOT trust `x-forwarded-for`
 * in production — clients can forge it. Use a trusted proxy header
 * (typically `CF-Connecting-IP` or `X-Real-IP`) configured via
 * TRUSTED_PROXY_HEADER. In dev we still allow x-forwarded-for because
 * you're running on localhost behind nothing.
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

// --- Backend selection --------------------------------------------------------

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let upstashLimiter: Ratelimit | null = null;
if (upstashUrl && upstashToken) {
  try {
    upstashLimiter = new Ratelimit({
      redis: new Redis({ url: upstashUrl, token: upstashToken }),
      // We can't know the caller's window/max here, so we expose a single
      // sliding-window configured for our heaviest traffic and the per-route
      // caps will be enforced through the prefix in the key. Upstash returns
      // { success } we map to the same boolean contract.
      limiter: Ratelimit.slidingWindow(60, "60 s"),
      analytics: false,
      prefix: "wwf:rl"
    });
  } catch (err) {
    // Never crash boot because of an optional limiter — fall back to memory.
    console.error("[rateLimit] Upstash init failed, falling back to memory:", err);
    upstashLimiter = null;
  }
}

function memoryCheck(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
    lastCleanup = now;
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

/**
 * Returns true if the request is within the limit (caller should proceed),
 * false if it has been rate-limited.
 *
 * The Upstash sliding-window in this module is capped at 60/min regardless
 * of the caller-supplied window/max — the per-route max is still meaningful
 * because callers do `await rateLimit("isc:" + ip, 3, 3600_000)`. For routes
 * that pass `max <= 60`, Upstash matches the intent closely enough; for
 * stricter routes (max 3-5), our memory bucket is the source of truth when
 * Upstash is configured (we override its result with the in-memory check
 * below to honour per-route limits exactly).
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  // Always run the in-memory check first — it honours (max, windowMs) exactly.
  const memo = memoryCheck(key, max, windowMs);
  if (!memo) return false;

  // If Upstash is configured, also consult it. This makes memory + Upstash
  // agree in dev, and means in production we have a second source of truth
  // that survives process restarts. We only enforce when it blocks; we
  // never override a memory allow into a block (memory is exact).
  if (upstashLimiter) {
    try {
      const res = await upstashLimiter.limit(key);
      if (!res.success) return false;
    } catch (err) {
      console.error("[rateLimit] Upstash check failed, allowing:", err);
    }
  }
  return true;
}

/**
 * Identify the caller safely. In production we MUST NOT trust
 * `x-forwarded-for` (clients send it directly). Use TRUSTED_PROXY_HEADER
 * if set (e.g. "cf-connecting-ip" behind Cloudflare, "x-real-ip" behind
 * nginx). If nothing trustworthy is set we return "unknown", which causes
 * all unidentified callers to share a bucket — this is the conservative
 * choice. In dev we still accept x-forwarded-for because nothing is in
 * front of localhost.
 */
export function clientKey(req: Request): string {
  // Read NODE_ENV at call time so tests can toggle it.
  const prod = process.env.NODE_ENV === "production";
  if (!prod) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim() || "unknown";
    return "local";
  }

  const trusted = process.env.TRUSTED_PROXY_HEADER?.toLowerCase();
  if (trusted) {
    const v = req.headers.get(trusted);
    if (v) {
      // Some proxies send a comma-separated list — take the first.
      const first = v.split(",")[0].trim();
      if (first) return first;
    }
  }
  return "unknown";
}
