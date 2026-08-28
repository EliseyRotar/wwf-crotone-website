import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/validate";

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
      if (
        !data.src.startsWith("/uploads/gallery/") &&
        !data.src.startsWith("/images/")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["src"],
          message: "invalid-image-src"
        });
      }
    }
    if (data.thumbnail) {
      if (
        !data.thumbnail.startsWith("/uploads/") &&
        !data.thumbnail.startsWith("/images/") &&
        !data.thumbnail.startsWith("https://")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["thumbnail"],
          message: "invalid-thumbnail"
        });
      }
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
  await prisma.galleryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
