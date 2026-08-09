import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages = ["", "about", "activities", "dates", "gallery", "support", "faq", "contact", "privacy", "packing-list", "mio-iscrizione"];
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ["it", "en"]) {
    for (const p of pages) {
      entries.push({
        url: `${base}/${locale}/${p}`,
        lastModified: now,
        changeFrequency: p === "" ? "weekly" as const : "monthly" as const,
        priority: p === "" ? 1 : p === "dates" ? 0.9 : 0.7,
        alternates: {
          languages: {
            it: `${base}/it/${p}`,
            en: `${base}/en/${p}`
          }
        }
      });
    }
  }

  const posts = await prisma.blogPost.findMany({
    where: { published: true, deletedAt: null },
    select: { slug: true, updatedAt: true }
  });
  for (const post of posts) {
    for (const locale of ["it", "en"]) {
      entries.push({
        url: `${base}/${locale}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: {
          languages: {
            it: `${base}/it/blog/${post.slug}`,
            en: `${base}/en/blog/${post.slug}`
          }
        }
      });
    }
  }

  return entries;
}
