/**
 * Cloudflare R2 upload helper for gallery images.
 *
 * Mirrors src/lib/r2Upload.ts but uses a separate bucket
 * (`wwf-gallery`) intended to be served from a custom domain
 * (gallery.wwfcrotone.it) without going through the Next.js app —
 * public images, no auth needed.
 *
 * Object key shape:
 *   gallery/<yyyy>/<random-uuid>.<ext>
 *
 * `uploadGalleryImage` returns the metadata we persist on the GalleryItem
 * row. The `url` field is the public CDN URL (custom domain).
 *
 * Auth: even though the bucket is public, we keep the API route
 * superadmin-only so a third party can't fill our bucket via the upload
 * endpoint. (The bucket's public-read custom-domain is only reached when
 * someone GETs an existing object key — uploads still need R2 creds.)
 */

import { serverEnv } from "@/env/server";

const R2_BUCKET = serverEnv.R2_GALLERY_BUCKET;
const R2_PUBLIC_BASE = serverEnv.R2_GALLERY_PUBLIC_BASE ?? "";

export type UploadGalleryResult = {
  objectKey: string;
  url: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
  originalName: string;
};

function getCreds(): {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
} {
  return {
    endpoint: serverEnv.AWS_ENDPOINT,
    region: serverEnv.AWS_REGION,
    accessKey: serverEnv.AWS_ACCESS_KEY_ID,
    secretKey: serverEnv.AWS_SECRET_ACCESS_KEY
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

async function sha256Hex(s: string | Uint8Array): Promise<string> {
  const data: ArrayBuffer = typeof s === "string"
    ? toBuffer(new TextEncoder().encode(s))
    : toBuffer(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

async function hmac(
  key: string | Uint8Array,
  data: string
): Promise<Uint8Array> {
  const keyData: ArrayBuffer = typeof key === "string"
    ? toBuffer(new TextEncoder().encode(key))
    : toBuffer(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const dataBytes = toBuffer(new TextEncoder().encode(data));
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  return new Uint8Array(sig);
}

function randomHex(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function sha256HexBytes(buf: Uint8Array): Promise<string> {
  return sha256Hex(buf);
}

/**
 * Sign a PUT request against R2 (SigV4). Same logic as r2Upload.ts —
 * kept duplicated here because the bucket host differs (wwf-gallery
 * instead of wwf-receipts) and the function is per-host.
 */
async function signPut(
  objectKey: string,
  bodyLength: number,
  contentType: string,
  payloadHash: string,
  creds: { endpoint: string; region: string; accessKey: string; secretKey: string }
): Promise<{ url: string; headers: Record<string, string> }> {
  const host = `${R2_BUCKET}.${creds.endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri = "/" + objectKey.split("/").map(encodeURIComponent).join("/");
  const amzDate = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  const finalHeaders =
    `content-length:${bodyLength}\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders =
    "content-length;content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `PUT\n${canonicalUri}\n\n${finalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const scope = `${dateStamp}/${creds.region}/s3/aws4_request`;
  const stringToSign =
    `${algorithm}\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmac(`AWS4${creds.secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, creds.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = bytesToHex(await hmac(kSigning, stringToSign));

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      "content-length": String(bodyLength),
      "content-type": contentType,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      authorization:
        `${algorithm} Credential=${creds.accessKey}/${dateStamp}/${creds.region}/s3/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      // Public bucket — 1 year immutable cache. The UUID filename means
      // we never need to bust the cache (re-upload = new key).
      "cache-control": "public, max-age=31536000, immutable"
    }
  };
}

/**
 * Sign a DELETE request against R2 (SigV4).
 * Used when an admin removes a GalleryItem — the object must be cleaned
 * up to avoid orphan storage accumulating.
 */
async function signDelete(
  objectKey: string,
  creds: { endpoint: string; region: string; accessKey: string; secretKey: string }
): Promise<{ url: string; headers: Record<string, string> }> {
  const host = `${R2_BUCKET}.${creds.endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri = "/" + objectKey.split("/").map(encodeURIComponent).join("/");
  const amzDate = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = "UNSIGNED-PAYLOAD";

  const finalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `DELETE\n${canonicalUri}\n\n${finalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const scope = `${dateStamp}/${creds.region}/s3/aws4_request`;
  const stringToSign =
    `${algorithm}\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmac(`AWS4${creds.secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, creds.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = bytesToHex(await hmac(kSigning, stringToSign));

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      authorization:
        `${algorithm} Credential=${creds.accessKey}/${dateStamp}/${creds.region}/s3/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  };
}

/**
 * Upload a gallery image File to the wwf-gallery bucket.
 *
 * Throws on any network/signing error. The API route catches and
 * translates to a 500.
 */
export async function uploadGalleryImage(
  file: File,
  category: string,
  year: number
): Promise<UploadGalleryResult> {
  const creds = getCreds();
  if (!creds) {
    throw new Error(
      "R2 credentials not configured (AWS_ENDPOINT / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)"
    );
  }
  if (!category || typeof category !== "string") {
    throw new Error("uploadGalleryImage: category is required");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`uploadGalleryImage: invalid year '${year}'`);
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(buf);
  const originalName = file.name || "upload";
  const extMatch = originalName.match(/\.([a-z0-9]{1,5})$/i);
  const ext = (extMatch?.[1] ?? "bin").toLowerCase();
  // UUID v4 via crypto.randomUUID()
  const objectKey = `gallery/${year}/${crypto.randomUUID()}.${ext}`;

  const signed = await signPut(
    objectKey,
    buf.length,
    file.type || "application/octet-stream",
    sha256,
    creds
  );

  const resp = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: buf
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `R2 upload failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 200)}`
    );
  }

  const host = `${R2_BUCKET}.${creds.endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri =
    "/" + objectKey.split("/").map(encodeURIComponent).join("/");
  // Prefer the custom-domain public URL when configured (gallery.wwfcrotone.it),
  // else fall back to the bucket host (only used in dev/test).
  const url = R2_PUBLIC_BASE
    ? `${R2_PUBLIC_BASE.replace(/\/+$/, "")}${canonicalUri}`
    : `https://${host}${canonicalUri}`;

  return {
    objectKey,
    url,
    sha256,
    byteSize: buf.length,
    mimeType: file.type || "application/octet-stream",
    originalName
  };
}

/**
 * Delete a gallery image from R2. Best-effort: a 404 is swallowed
 * because the object may already be gone (e.g. after a partial backfill).
 */
export async function deleteGalleryImage(objectKey: string): Promise<void> {
  const creds = getCreds();
  if (!creds) {
    throw new Error("R2 credentials not configured");
  }
  if (!objectKey || typeof objectKey !== "string" || !objectKey.startsWith("gallery/")) {
    throw new Error(`deleteGalleryImage: invalid objectKey '${objectKey}'`);
  }
  const signed = await signDelete(objectKey, creds);
  const resp = await fetch(signed.url, {
    method: "DELETE",
    headers: signed.headers
  });
  // 404 means it's already gone — that's fine. Other errors are real failures.
  if (resp.status === 404) return;
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `R2 delete failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 200)}`
    );
  }
}

/**
 * Verify the gallery R2 configuration is usable. Throws if R2 creds
 * are missing. Used at the top of the admin gallery upload route.
 */
export function assertGalleryR2Ready(): void {
  if (!getCreds()) {
    throw new Error(
      "R2 credentials not configured (AWS_ENDPOINT / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)"
    );
  }
}
