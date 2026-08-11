/**
 * Cloudflare R2 (S3-compatible) upload helper for receipt files.
 *
 * Mirrors the AWS SigV4 signing pattern used by scripts/r2-quota-check.js
 * but adapted for Node — we use `crypto.subtle` for HMAC-SHA256, which
 * works in both the Node and edge runtimes.
 *
 * Object key shape:
 *   receipts/<iscrizioneId>/<type>-<timestamp>-<random>.<ext>
 *
 * `uploadReceipt` returns the metadata we persist in the
 * ReceiptUpload row. The `url` field is the R2 public URL — the admin
 * UI routes reads through a /api/admin/iscrizioni/[id]/receipt
 * proxy that checks the session (so we never expose R2 credentials to
 * the browser).
 */

const R2_BUCKET = process.env.R2_RECEIPTS_BUCKET ?? "wwf-receipts";

export type UploadReceiptResult = {
  objectKey: string;
  url: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
  originalName: string;
};

function getCreds():
  | { endpoint: string; region: string; accessKey: string; secretKey: string }
  | null {
  const endpoint = process.env.AWS_ENDPOINT;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  const region = process.env.AWS_REGION ?? "auto";
  return { endpoint, region, accessKey, secretKey };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(s: string | Uint8Array): Promise<string> {
  const data: ArrayBuffer = typeof s === "string"
    ? new TextEncoder().encode(s).buffer as ArrayBuffer
    : (s.buffer as ArrayBuffer);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

async function hmac(
  key: string | Uint8Array,
  data: string
): Promise<Uint8Array> {
  const keyData: ArrayBuffer = typeof key === "string"
    ? new TextEncoder().encode(key).buffer as ArrayBuffer
    : (key.buffer as ArrayBuffer);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data).buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

function randomHex(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Sign a PUT to upload a body of `payloadHash` to `objectKey` on R2.
 * Returns the absolute URL and the headers we have to set.
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
      Authorization:
        `${algorithm} Credential=${creds.accessKey}/${dateStamp}/${creds.region}/s3/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  };
}

/**
 * Compute the SHA-256 hex of a Buffer/Uint8Array. Public so the API
 * route can pre-compute it once and pass it both to this helper and to
 * the ReceiptUpload row.
 */
export async function sha256HexBytes(buf: Uint8Array): Promise<string> {
  return sha256Hex(buf);
}

/**
 * Upload a receipt File to the wwf-receipts bucket. Returns the
 * metadata to persist on the ReceiptUpload row.
 *
 * Throws on any network/signing error — the API route catches and
 * translates to a 500. We intentionally do NOT swallow the error:
 * silently dropping the upload is the worst outcome.
 */
export async function uploadReceipt(
  file: File,
  iscrizioneId: string,
  type: "deposit" | "balance"
): Promise<UploadReceiptResult> {
  const creds = getCreds();
  if (!creds) {
    throw new Error(
      "R2 credentials not configured (AWS_ENDPOINT / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)"
    );
  }
  if (!iscrizioneId || typeof iscrizioneId !== "string") {
    throw new Error("uploadReceipt: iscrizioneId is required");
  }
  if (type !== "deposit" && type !== "balance") {
    throw new Error(`uploadReceipt: invalid type '${type}'`);
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(buf);
  const ext = extFromMime(file.type);
  const objectKey = `receipts/${iscrizioneId}/${type}-${Date.now()}-${randomHex(6)}.${ext}`;

  // "UNSIGNED-PAYLOAD" tells R2 to skip the body hash in the canonical
  // request, which avoids us having to base64 the entire body in the
  // signature input. The body hash we send in x-amz-content-sha256 is
  // still the real hash so R2 can verify integrity on its side.
  const payloadHash = "UNSIGNED-PAYLOAD";
  const signed = await signPut(
    objectKey,
    buf.length,
    file.type || "application/octet-stream",
    payloadHash,
    creds
  );

  // Overwrite the content-sha256 header with the real hex hash so R2
  // can verify the body matches what we signed.
  signed.headers["x-amz-content-sha256"] = sha256;

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

  // Public URL. The admin UI reads through a session-checked proxy
  // (`/api/admin/iscrizioni/[id]/receipt/[receiptId]`), so we never
  // embed raw R2 URLs in the browser. The host here is fine to
  // persist on the row for server-side fetches.
  const host = `${R2_BUCKET}.${creds.endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri =
    "/" + objectKey.split("/").map(encodeURIComponent).join("/");
  const url = `https://${host}${canonicalUri}`;

  return {
    objectKey,
    url,
    sha256,
    byteSize: buf.length,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || `receipt.${ext}`
  };
}

/**
 * Download a receipt's bytes from R2. Used by the admin read-through
 * proxy to stream the file back to an authenticated browser.
 *
 * Returns the bytes and the content type, or null if R2 returns 404
 * (so the proxy can serve a clean 404 instead of a 500).
 */
export async function fetchReceipt(
  objectKey: string
): Promise<{ body: Uint8Array; contentType: string; size: number } | null> {
  const creds = getCreds();
  if (!creds) throw new Error("R2 credentials not configured");

  // Sign a GET. We use the same canonical-request shape as the script
  // (querystring empty for a vanilla object GET).
  const host = `${R2_BUCKET}.${creds.endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri =
    "/" + objectKey.split("/").map(encodeURIComponent).join("/");
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
  const canonicalRequest = `GET\n${canonicalUri}\n\n${finalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const scope = `${dateStamp}/${creds.region}/s3/aws4_request`;
  const stringToSign =
    `${algorithm}\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmac(`AWS4${creds.secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, creds.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = bytesToHex(await hmac(kSigning, stringToSign));

  const url = `https://${host}${canonicalUri}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      Authorization:
        `${algorithm} Credential=${creds.accessKey}/${dateStamp}/${creds.region}/s3/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `R2 fetch failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 200)}`
    );
  }
  const ab = await resp.arrayBuffer();
  const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
  return { body: new Uint8Array(ab), contentType, size: ab.byteLength };
}
