import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { uploadGalleryImage, assertGalleryR2Ready } from "@/lib/r2Gallery";

export const dynamic = "force-dynamic";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4"
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Strict magic-byte check. Audit found that the previous WebP check
 * (just "RIFF" prefix) matched any RIFF container (.wav, .avi, etc.)
 * and the MP4 check accepted any `....ftyp` payload. This version
 * verifies the full format signature:
 *   PNG:  89 50 4E 47 0D 0A 1A 0A
 *   JPEG: FF D8 FF (with a valid JFIF/Exif marker after)
 *   GIF:  47 49 46 38 (37 or 39) — "GIF87a" or "GIF89a"
 *   WebP: "RIFF" .... "WEBP" (the WEBP marker at offset 8)
 *   MP4:  any size, then "ftyp" at offset 4, with a recognised major brand
 */
function isValidImageOrVideo(buf: Uint8Array, ext: string): boolean {
  if (buf.length < 12) return false;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === "png") {
    return (
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
    );
  }

  // JPEG: FF D8 FF, then a known SOF marker (E0=APP0/JFIF, E1=APP1/Exif, DB=quant, etc.)
  if (ext === "jpg") {
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return false;
    const marker = buf[3];
    // Accept JFIF (E0), Exif (E1), quantisation tables (DB), Huffman tables (C4),
    // frame start (C0 SOF0 baseline), start of image (C2 SOF2 progressive).
    return (
      marker === 0xe0 || marker === 0xe1 || marker === 0xdb ||
      marker === 0xc4 || (marker >= 0xc0 && marker <= 0xcf)
    );
  }

  // GIF: "GIF87a" or "GIF89a"
  if (ext === "gif") {
    return (
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 &&
      buf[3] === 0x38 && (buf[4] === 0x37 || buf[4] === 0x39) &&
      buf[5] === 0x61
    );
  }

  // WebP: "RIFF" + 4 bytes size + "WEBP"
  if (ext === "webp") {
    if (!(buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)) {
      return false;
    }
    return buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  }

  // MP4: bytes 4-7 = "ftyp", bytes 8-11 = major brand
  if (ext === "mp4") {
    if (!(buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70)) {
      return false;
    }
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    // Common MP4 major brands
    return (
      brand === "isom" || brand === "iso2" || brand === "mp41" || brand === "mp42" ||
      brand === "avc1" || brand === "M4V " || brand === "M4A " || brand === "qt  " ||
      brand === "dash" || brand === "mp71"
    );
  }

  return false;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`upload:${clientKey(req)}`, 30, 900_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "no-file" }, { status: 400 });

  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "too-big" }, { status: 400 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  if (!isValidImageOrVideo(buf, ext)) {
    return NextResponse.json({ ok: false, error: "invalid-content" }, { status: 400 });
  }

  try {
    assertGalleryR2Ready();
  } catch (err) {
    console.error("[admin/upload] R2 not configured:", err);
    return NextResponse.json({ ok: false, error: "r2-not-configured" }, { status: 503 });
  }

  // Year defaults to current year. Caller can override via the form.
  const formYear = Number(form.get("year"));
  const year = Number.isInteger(formYear) && formYear >= 2000 && formYear <= 2100
    ? formYear
    : new Date().getFullYear();
  const formCategory = String(form.get("category") ?? "");
  if (!formCategory || formCategory.length > 64) {
    return NextResponse.json({ ok: false, error: "missing-category" }, { status: 400 });
  }

  try {
    const result = await uploadGalleryImage(file, formCategory, year);
    return NextResponse.json({
      ok: true,
      src: result.url,
      objectKey: result.objectKey,
      sha256: result.sha256,
      byteSize: result.byteSize,
      mimeType: result.mimeType
    });
  } catch (err) {
    console.error("[admin/upload] R2 upload failed:", err);
    return NextResponse.json(
      { ok: false, error: "r2-upload-failed" },
      { status: 502 }
    );
  }
}
