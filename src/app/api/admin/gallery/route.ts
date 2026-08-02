import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const VALID_CATS = ["tartarughe", "cleanup", "wildlife", "campo", "schiuse", "cultura", "crtm", "tartamar", "turtledog"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`gallery:${clientKey(req)}`, 20, 900_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const body = await req.json();
  const { type, src, thumbnail, titleIt, titleEn, captionIt, captionEn, category, year } = body;

  if (type !== "image" && type !== "video") {
    return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
  }
  if (!VALID_CATS.includes(category)) {
    return NextResponse.json({ ok: false, error: "invalid-category" }, { status: 400 });
  }
  if (typeof src !== "string" || !src) {
    return NextResponse.json({ ok: false, error: "missing-src" }, { status: 400 });
  }
  if (type === "video") {
    if (!/^[A-Za-z0-9_-]{11}$/.test(src)) {
      return NextResponse.json({ ok: false, error: "invalid-video-id" }, { status: 400 });
    }
  } else {
    if (!src.startsWith("/uploads/gallery/") && !src.startsWith("/images/")) {
      return NextResponse.json({ ok: false, error: "invalid-image-src" }, { status: 400 });
    }
  }
  if (thumbnail && typeof thumbnail === "string") {
    if (!thumbnail.startsWith("/uploads/") && !thumbnail.startsWith("/images/") && !thumbnail.startsWith("https://")) {
      return NextResponse.json({ ok: false, error: "invalid-thumbnail" }, { status: 400 });
    }
  }
  if (!titleIt || typeof titleIt !== "string" || titleIt.length > 200) {
    return NextResponse.json({ ok: false, error: "invalid-title" }, { status: 400 });
  }
  if (captionIt && typeof captionIt === "string" && captionIt.length > 2000) {
    return NextResponse.json({ ok: false, error: "caption-too-long" }, { status: 400 });
  }

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
      year: Number(year) || new Date().getFullYear(),
      uploaderId: session.id
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  await prisma.galleryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
