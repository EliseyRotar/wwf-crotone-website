#!/usr/bin/env node
/**
 * scripts/r2-quota-check.js — daily R2 free-tier quota check.
 *
 * Reads the size of the wwf-backups bucket and emits a Sentry breadcrumb
 * (not an error — a breadcrumb is just a log line) so we can see the
 * historical trend in Sentry Issues → Activity.
 *
 * If we cross 80% of any free-tier limit, this script exits with code 2
 * (warning) or 3 (critical) so a daily cron + a Sentry alert rule can
 * trigger a real notification.
 *
 * Why not just let R2 reject uploads silently? Because backups failing
 * without warning is the worst kind of failure — we'd only notice when
 * we tried to restore.
 *
 * Run:  node scripts/r2-quota-check.js
 * Env:  AWS_ENDPOINT, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *       SENTRY_DSN (optional — sentry breadcrumb only)
 */

const BUCKET = process.env.R2_BUCKET || "wwf-backups";

// Free tier limits as of 2026 — verify at
// https://developers.cloudflare.com/r2/pricing/
const FREE_TIER = {
  storage_gb: 10,                 // 10 GB / month (always free)
  class_a_ops: 1_000_000,         // writes + lists
  class_b_ops: 10_000_000,        // reads + heads
};

const SENTRY_DSN = process.env.SENTRY_DSN || "";

async function signRequest(method, endpoint, bucket, accessKey, secretKey, querystring = "", payloadHash = "") {
  // The querystring passed in MUST be the raw, sorted, percent-encoded
  // string that we use in the URL — S3 v4 signing uses the canonical
  // query string which IS the URL-encoded query string.
  const host = `${bucket}.${endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri = "/";
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${""}\n`; // placeholder, replaced below
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  const finalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${canonicalUri}\n${querystring}\n${finalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const algorithm = "AWS4-HMAC-SHA256";
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${scope}\n${await sha256(canonicalRequest)}`;

  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, "auto");
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = bytesToHex(await hmac(kSigning, stringToSign));

  return {
    url: `https://${host}/?${querystring}`,
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": `${algorithm} Credential=${accessKey}/${dateStamp}/auto/s3/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/**
 * Build a properly-encoded, sorted query string for S3 signing.
 * Keys must be sorted alphabetically. Values are URI-encoded (but
 * alphanumerics and `-_.~` are NOT encoded per AWS spec).
 */
function buildQueryString(params) {
  const sortedKeys = Object.keys(params).sort();
  return sortedKeys
    .map((k) => {
      const v = params[k];
      // Don't double-encode: if the value already contains %, it's been encoded
      const enc = v.includes("%") || /^[a-zA-Z0-9\-_.~]+$/.test(v)
        ? v
        : encodeURIComponent(v);
      return `${encodeURIComponent(k)}=${enc}`;
    })
    .join("&");
}

async function listAllObjects(endpoint, accessKey, secretKey) {
  const all = [];
  let continuationToken = null;
  const emptyHash = await sha256("");

  do {
    const params = { "list-type": "2", "max-keys": "1000" };
    if (continuationToken) params["continuation-token"] = continuationToken;
    const qs = buildQueryString(params);

    const sig = await signRequest("GET", endpoint, BUCKET, accessKey, secretKey, qs, emptyHash);
    const resp = await fetch(sig.url, { headers: sig.headers });
    if (!resp.ok) throw new Error(`S3 list-objects-v2 failed: ${resp.status} ${await resp.text()}`);
    const xml = await resp.text();
    const matches = [...xml.matchAll(/<Contents>[\s\S]*?<\/Contents>/g)];
    for (const m of matches) {
      const block = m[0];
      const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] ?? "";
      const size = parseInt(block.match(/<Size>([^<]+)<\/Size>/)?.[1] ?? "0", 10);
      all.push({ key, size });
    }
    // Check for continuation token (truncated response)
    const nextMatch = xml.match(/<IsTruncated>true<\/IsTruncated>/);
    if (!nextMatch) break;
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    continuationToken = tokenMatch ? tokenMatch[1] : null;
    if (!continuationToken) break;
  } while (continuationToken);

  return all;
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return bytesToHex(new Uint8Array(buf));
}
async function hmac(key, data) {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}
function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendSentryBreadcrumb(level, message, data) {
  if (!SENTRY_DSN) return;
  const m = SENTRY_DSN.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!m) return;
  const [, key, host, project] = m;
  const url = `https://${host}/api/${project}/store/`;
  const body = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level,
    logger: "r2-quota",
    message: { formatted: message },
    extra: data,
  };
  const item = { type: "event" };
  const itemJson = JSON.stringify(body);
  item.length = new TextEncoder().encode(itemJson).length;
  const envelope =
    JSON.stringify({ event_id: body.event_id, dsn: SENTRY_DSN, sent_at: new Date().toISOString() }) +
    "\n" + JSON.stringify(item) + "\n" + itemJson + "\n";
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_key=${key}, sentry_version=7`,
    },
    body: envelope,
  });
}

async function main() {
  const endpoint = process.env.AWS_ENDPOINT;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKey || !secretKey) {
    console.error("Missing R2 credentials (AWS_ENDPOINT / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)");
    process.exit(1);
  }

  let objects;
  try {
    objects = await listAllObjects(endpoint, accessKey, secretKey);
  } catch (e) {
    console.error("R2 list failed:", e.message);
    await sendSentryBreadcrumb("error", "R2 list-objects-v2 failed", { error: e.message });
    process.exit(1);
  }

  const totalBytes = objects.reduce((sum, o) => sum + o.size, 0);
  const totalGb = totalBytes / 1024 / 1024 / 1024;
  const usagePct = (totalGb / FREE_TIER.storage_gb) * 100;

  const data = {
    bucket: BUCKET,
    objects: objects.length,
    total_gb: Number(totalGb.toFixed(4)),
    free_tier_gb: FREE_TIER.storage_gb,
    usage_pct: Number(usagePct.toFixed(2)),
    largest: objects
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, 3)
      .map((o) => ({ key: o.key, kb: Number((o.size / 1024).toFixed(1)) })),
  };

  console.log(JSON.stringify(data, null, 2));

  // Determine log level based on usage
  let level = "info";
  let exitCode = 0;
  if (usagePct >= 80) {
    level = "warning";
    exitCode = 2;
  }
  if (usagePct >= 95) {
    level = "error";
    exitCode = 3;
  }

  await sendSentryBreadcrumb(level, `R2 ${BUCKET} ${usagePct.toFixed(2)}% used`, data);

  if (exitCode > 0) {
    console.error(`!! R2 quota warning: ${usagePct.toFixed(2)}% of free tier used`);
    process.exit(exitCode);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});