import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { sanitizeHtml, LIMITS } from "@/lib/validate";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: { id: true, slug: true, titleIt: true, titleEn: true, excerptIt: true, excerptEn: true, imageUrl: true, publishedAt: true }
  });
  return NextResponse.json({ ok: true, posts });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { titleIt, titleEn, contentIt, contentEn, excerptIt, excerptEn, imageUrl, published } = body;
  if (!titleIt || !contentIt) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  if (typeof titleIt !== "string" || titleIt.length > 200) return NextResponse.json({ ok: false, error: "title-too-long" }, { status: 400 });
  if (typeof contentIt !== "string" || contentIt.length > LIMITS.MAX_BLOG_CONTENT) return NextResponse.json({ ok: false, error: "content-too-long" }, { status: 400 });

  const slug = titleIt.toLowerCase()
    .replace(/[àáâäãå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
    .replace(/[òóôöõ]/g, "o").replace(/[ùúûü]/g, "u").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const post = await prisma.blogPost.create({
    data: {
      slug,
      titleIt,
      titleEn: titleEn || null,
      contentIt: sanitizeHtml(contentIt),
      contentEn: contentEn ? sanitizeHtml(contentEn) : null,
      excerptIt: excerptIt ? sanitizeHtml(excerptIt) : null,
      excerptEn: excerptEn ? sanitizeHtml(excerptEn) : null,
      imageUrl: imageUrl || null,
      published: !!published,
      publishedAt: published ? new Date() : null,
      authorId: session.id
    }
  });
  await logAudit({
    userId: session.id,
    action: "create",
    entity: "blog_post",
    entityId: post.id,
    details: JSON.stringify({ slug, titleIt, published: !!published })
  });
  return NextResponse.json({ ok: true, id: post.id, slug });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

  const allowed = ["titleIt", "titleEn", "contentIt", "contentEn", "excerptIt", "excerptEn", "imageUrl", "published"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      if (["contentIt", "contentEn", "excerptIt", "excerptEn"].includes(k) && typeof fields[k] === "string") {
        data[k] = sanitizeHtml(fields[k]);
      } else {
        data[k] = fields[k];
      }
    }
  }
  if (data.published === true) data.publishedAt = new Date();

  await prisma.blogPost.update({ where: { id }, data });
  await logAudit({
    userId: session.id,
    action: "update",
    entity: "blog_post",
    entityId: id,
    details: JSON.stringify({ keys: Object.keys(data) })
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  await prisma.blogPost.delete({ where: { id } });
  await logAudit({
    userId: session.id,
    action: "delete",
    entity: "blog_post",
    entityId: id
  });
  return NextResponse.json({ ok: true });
}
