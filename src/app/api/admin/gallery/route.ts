import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";
import { deleteGalleryImage } from "@/lib/r2Gallery";

export const dynamic = "force-dynamic";

const CATEGORY_ENUM = [
  "tartarughe",
  "cleanup",
  "wildlife",
  "campo",
  "schiuse",
  "cultura",
  "crtm",
  "tartamar",
  "turtledog"
] as const;

/**
 * Allowed prefixes for a GalleryItem.src. New items uploaded via the
 * admin form get a URL from src/lib/r2Gallery.ts (R2 wwf-gallery bucket
 * served via the public R2 host or a custom domain like
 * gallery.wwfcrotone.it). Existing items may still point at the old
 * /uploads/gallery/ or /images/ static paths.
 *
 * Accepted shapes:
 *   - https://<bucket>.<endpoint>/gallery/...            (R2 public host)
 *   - https://gallery.wwfcrotone.it/gallery/...           (custom domain)
 *   - /uploads/gallery/...                               (legacy)
 *   - /images/...                                        (legacy)
 *   - /uploads/gallery/... (YouTube-id case — but that's `type: video`)
 */
const R2_PUBLIC_BASE = process.env.R2_GALLERY_PUBLIC_BASE?.replace(/\/+$/, "") ?? "";
const R2_BUCKET = process.env.R2_GALLERY_BUCKET ?? "wwf-gallery";
const R2_ENDPOINT_HOST = (process.env.AWS_ENDPOINT ?? "").replace(/^https?:\/\//, "");

function isAllowedImageSrc(src: string): boolean {
  // R2 custom domain
  if (R2_PUBLIC_BASE && src.startsWith(R2_PUBLIC_BASE + "/")) return true;
  // R2 bucket host (R2_PUBLIC_BASE not configured — dev)
  if (R2_ENDPOINT_HOST && src.startsWith(`https://${R2_BUCKET}.${R2_ENDPOINT_HOST}/gallery/`)) return true;
  // Legacy static paths
  if (src.startsWith("/uploads/gallery/")) return true;
  if (src.startsWith("/images/")) return true;
  return false;
}

function isAllowedThumbnail(src: string): boolean {
  // ImageKit-style / instagram CDN / YouTube thumbnails all OK
  return (
    src.startsWith("/uploads/") ||
    src.startsWith("/images/") ||
    src.startsWith("https://") ||
    src.startsWith("http://")
  );
}

const CreateGallerySchema = z
  .object({
    type: z.enum(["image", "video"]),
    src: z.string().min(1).max(2000),
    thumbnail: z.string().max(2000).nullable().optional(),
    titleIt: z.string().trim().min(1).max(200),
    titleEn: z.string().trim().max(200).nullable().optional(),
    captionIt: z.string().trim().max(2000).nullable().optional(),
    captionEn: z.string().trim().max(2000).nullable().optional(),
    category: z.enum(CATEGORY_ENUM),
    year: z.number().int().min(1900).max(2100).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === "video") {
      if (!/^[A-Za-z0-9_-]{11}$/.test(data.src)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["src"],
          message: "invalid-video-id"
        });
      }
    } else {
      if (!isAllowedImageSrc(data.src)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["src"],
          message: "invalid-image-src"
        });
      }
    }
    if (data.thumbnail && !isAllowedThumbnail(data.thumbnail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thumbnail"],
        message: "invalid-thumbnail"
      });
    }
  });

const DeleteGallerySchema = z
  .object({
    id: z.string().min(1).max(64)
  })
  .strict();

async function requireSuperadmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  if (session.role !== "superadmin") {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function readJson(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`gallery:${clientKey(req)}`, 20, 900_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = CreateGallerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { type, src, thumbnail, titleIt, titleEn, captionIt, captionEn, category, year } = parsed.data;

  await prisma.galleryItem.create({
    data: {
      type,
      src,
      thumbnail: thumbnail ?? null,
      titleIt,
      titleEn: titleEn ?? null,
      captionIt: captionIt ?? null,
      captionEn: captionEn ?? null,
      category,
      year: year ?? new Date().getFullYear(),
      uploaderId: guard.session.id
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = DeleteGallerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id } = parsed.data;

  // Load the row first so we can clean up the R2 object too.
  const item = await prisma.galleryItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // Try to delete the R2 object. Best-effort — if R2 creds are missing
  // or the object is already gone, we still delete the DB row.
  if (item.src.startsWith("https://") && item.src.includes("/gallery/")) {
    // Extract the object key from the URL.
    const marker = "/gallery/";
    const idx = item.src.indexOf(marker);
    if (idx !== -1) {
      const objectKey = `gallery/${item.src.slice(idx + marker.length)}`;
      try {
        await deleteGalleryImage(objectKey);
      } catch (err) {
        console.error(`[admin/gallery] failed to delete R2 object ${objectKey}:`, err);
      }
    }
  }

  await prisma.galleryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
