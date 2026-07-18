import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import BlogManager from "@/components/admin/BlogManager";

export const dynamic = "force-dynamic";

export default async function BlogAdminPage() {
  await requireSuperadmin();
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return <BlogManager posts={posts.map((p) => ({
    id: p.id, slug: p.slug, titleIt: p.titleIt, titleEn: p.titleEn,
    excerptIt: p.excerptIt, contentIt: p.contentIt, contentEn: p.contentEn,
    published: p.published, publishedAt: p.publishedAt?.toISOString() ?? null
  }))} />;
}