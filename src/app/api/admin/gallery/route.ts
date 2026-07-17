import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_CATS = ["tartarughe", "cleanup", "wildlife", "campo", "schiuse", "cultura", "crtm", "tartamar", "turtledog"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { type, src, thumbnail, titleIt, titleEn, captionIt, captionEn, category, year } = body;

  // Validate type
  if (type !== "image" && type !== "video") {
    return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
  }
  // Validate category
  if (!VALID_CATS.includes(category)) {
    return NextResponse.json({ ok: false, error: "invalid-category" }, { status: 400 });
  }
  // Validate src
  if (typeof src !== "string" || !src) {
    return NextResponse.json({ ok: false, error: "missing-src" }, { status: 400 });
  }
  if (type === "video") {
    // YouTube ID is exactly 11 chars [A-Za-z0-9_-]
    if (!/^[A-Za-z0-9_-]{11}$/.test(src)) {
      return NextResponse.json({ ok: false, error: "invalid-video-id" }, { status: 400 });
    }
  } else {
    // Image src must be a local path under /uploads/gallery/ or /images/
    if (!src.startsWith("/uploads/gallery/") && !src.startsWith("/images/")) {
      return NextResponse.json({ ok: false, error: "invalid-image-src" }, { status: 400 });
    }
  }
  if (!titleIt || typeof titleIt !== "string" || titleIt.length > 200) {
    return NextResponse.json({ ok: false, error: "invalid-title" }, { status: 400 });
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
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  await prisma.galleryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}