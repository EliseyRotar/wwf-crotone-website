#!/usr/bin/env node
/**
 * One-shot backfill script: migrate existing gallery images from
 * /srv/wwf/assets/uploads/gallery/ (served by nginx) to the wwf-gallery
 * R2 bucket (served by gallery.wwfcrotone.it via Cloudflare).
 *
 * After this script:
 *   - Every existing <uuid>.<ext> file in /srv/wwf/assets/uploads/gallery/
 *     is uploaded to R2 with key gallery/<year>/<new-uuid>.<ext>.
 *   - The corresponding GalleryItem.src row is rewritten from
 *     `/uploads/gallery/<uuid>.<ext>` to
 *     `https://gallery.wwfcrotone.it/gallery/<year>/<new-uuid>.<ext>`.
 *
 * Run once after deploying the gallery-to-R2 migration:
 *   docker exec -w /app infra-app-1 node scripts/migrate-gallery-to-r2.mjs
 *
 * Idempotent: re-running is a no-op (skips rows whose src is already
 * an R2 URL).
 *
 * Required env (same as the app):
 *   AWS_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *   AWS_REGION, R2_GALLERY_BUCKET, R2_GALLERY_PUBLIC_BASE, DATABASE_URL
 */

import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const LOCAL_DIR = "/srv/wwf/assets/uploads/gallery";
const prisma = new PrismaClient();

const R2_BUCKET = process.env.R2_GALLERY_BUCKET ?? "wwf-gallery";
const R2_PUBLIC_BASE = process.env.R2_GALLERY_PUBLIC_BASE?.replace(/\/+$/, "") ?? "";
const R2_ENDPOINT_HOST = (process.env.AWS_ENDPOINT ?? "").replace(/^https?:\/\//, "");

function getCreds() {
  const endpoint = process.env.AWS_ENDPOINT;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  const region = process.env.AWS_REGION ?? "auto";
  return { endpoint, region, accessKey, secretKey };
}

// SigV4 helpers (mirrored from src/lib/r2Upload.ts + r2Gallery.ts)
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function toBuffer(view) {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}
async function sha256Hex(s) {
  const data = typeof s === "string"
    ? toBuffer(new TextEncoder().encode(s))
    : toBuffer(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}
async function hmac(key, data) {
  const keyData = typeof key === "string"
    ? toBuffer(new TextEncoder().encode(key))
    : toBuffer(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const dataBytes = toBuffer(new TextEncoder().encode(data));
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  return new Uint8Array(sig);
}

async function signPut(objectKey, bodyLength, contentType, payloadHash, creds) {
  const host = `${R2_BUCKET}.${creds.endpoint.replace(/^https?:\/\//, "")}`;
  const canonicalUri = "/" + objectKey.split("/").map(encodeURIComponent).join("/");
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const finalHeaders =
    `content-length:${bodyLength}\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-length;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${finalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const algorithm = "AWS4-HMAC-SHA256";
  const scope = `${dateStamp}/${creds.region}/s3/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;
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
      "authorization":
        `${algorithm} Credential=${creds.accessKey}/${dateStamp}/${creds.region}/s3/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "cache-control": "public, max-age=31536000, immutable"
    }
  };
}

function detectMimeType(ext) {
  const map = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4"
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

async function main() {
  if (!R2_PUBLIC_BASE) {
    console.error("ERROR: R2_GALLERY_PUBLIC_BASE is not set. Aborting.");
    process.exit(1);
  }
  const creds = getCreds();
  if (!creds) {
    console.error("ERROR: R2 credentials missing. Aborting.");
    process.exit(1);
  }

  // Read all files in the local uploads dir
  let files;
  try {
    files = await readdir(LOCAL_DIR);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`No local directory at ${LOCAL_DIR} — nothing to migrate.`);
      return;
    }
    throw err;
  }

  console.log(`Found ${files.length} files in ${LOCAL_DIR}`);
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const filename of files) {
    const localPath = path.join(LOCAL_DIR, filename);
    const ext = path.extname(filename).slice(1);
    if (!ext) {
      console.warn(`Skipping ${filename} (no extension)`);
      skipped++;
      continue;
    }

    // Look up the GalleryItem whose src matches /uploads/gallery/
    const oldSrc = `/uploads/gallery/${filename}`;
    const item = await prisma.galleryItem.findFirst({
      where: { src: oldSrc }
    });
    if (!item) {
      console.warn(`No DB row for ${oldSrc} — orphan file, leaving on disk`);
      skipped++;
      continue;
    }
    // Skip if already migrated (idempotent re-run)
    if (item.src.startsWith(`${R2_PUBLIC_BASE}/`)) {
      console.log(`Already migrated: ${item.src}`);
      skipped++;
      continue;
    }

    // Read file bytes
    const buf = await readFile(localPath);
    const newObjectKey = `gallery/${item.year ?? new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const contentType = detectMimeType(ext);
    const sha256 = await sha256Hex(new Uint8Array(buf));

    const signed = await signPut(newObjectKey, buf.length, contentType, sha256, creds);
    const resp = await fetch(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body: buf
    });
    if (!resp.ok) {
      console.error(`R2 upload failed for ${filename}: ${resp.status} ${await resp.text()}`);
      errors++;
      continue;
    }

    const newSrc = `${R2_PUBLIC_BASE}/${newObjectKey}`;
    await prisma.galleryItem.update({
      where: { id: item.id },
      data: { src: newSrc }
    });

    // Best-effort delete local file. If we can't, we just have a small
    // wasted inode — the nginx /uploads/ block now 404s anyway.
    try {
      await unlink(localPath);
    } catch (err) {
      console.warn(`Failed to delete local file ${localPath}: ${err.message}`);
    }
    console.log(`Migrated ${oldSrc} -> ${newSrc}`);
    migrated++;
  }

  console.log(`\n=== Done ===`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Errors:   ${errors}`);
  await prisma.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
