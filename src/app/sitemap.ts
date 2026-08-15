import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * /sitemap.xml — rich sitemap for the WWF Crotone site.
 *
 * Per Google's sitemap.org spec (https://www.sitemaps.org/protocol.html):
 *  - One entry per URL per locale (IT + EN)
 *  - <lastmod> in W3C datetime (we use ISO)
 *  - <changefreq> is a hint (Google may ignore it)
 *  - <priority> is relative within the site (default 0.5)
 *  - <xhtml:link rel="alternate"> hreflang pairs so Google indexes
 *    both languages for each page
 *  - Images listed under <image:image> for the public gallery
 *
 * Public static routes + the published blog posts. Account/dashboard
 * routes are intentionally excluded (private).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wwfcrotone.it";
  const now = new Date();
  const locales = ["it", "en"] as const;

  // ─── Static public routes ─────────────────────────────────────────
  // priority = relative within site; home=1.0, key conversion pages
  // (dates, about, activities) = 0.9, content pages = 0.7, secondary
  // = 0.5.
  const staticPages: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }> = [
    { path: "",             priority: 1.0,  changeFrequency: "weekly"  },
    { path: "dates",        priority: 0.9,  changeFrequency: "weekly"  },
    { path: "about",        priority: 0.9,  changeFrequency: "monthly" },
    { path: "activities",   priority: 0.9,  changeFrequency: "monthly" },
    { path: "blog",         priority: 0.8,  changeFrequency: "weekly"  },
    { path: "gallery",      priority: 0.7,  changeFrequency: "monthly" },
    { path: "faq",          priority: 0.7,  changeFrequency: "monthly" },
    { path: "contact",      priority: 0.7,  changeFrequency: "yearly"  },
    { path: "support",      priority: 0.7,  changeFrequency: "monthly" },
    { path: "packing-list", priority: 0.5,  changeFrequency: "yearly"  },
    { path: "privacy",      priority: 0.3,  changeFrequency: "yearly"  }
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    for (const locale of locales) {
      entries.push({
        url: `${base}/${locale}/${page.path}`.replace(/\/$/, "") || `${base}/${locale}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: {
            it: `${base}/it/${page.path}`.replace(/\/$/, "") || `${base}/it`,
            en: `${base}/en/${page.path}`.replace(/\/$/, "") || `${base}/en`,
            "x-default": `${base}/it/${page.path}`.replace(/\/$/, "") || `${base}/it`
          }
        }
      });
    }
  }

  // ─── Blog posts ────────────────────────────────────────────────────
  const posts = await prisma.blogPost.findMany({
    where: { published: true, deletedAt: null },
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true,
      imageUrl: true,
      titleIt: true,
      titleEn: true
    },
    orderBy: { publishedAt: "desc" }
  });

  for (const post of posts) {
    const lastModified = post.updatedAt ?? post.publishedAt ?? now;
    for (const locale of locales) {
      const imageUrl = post.imageUrl
        ? post.imageUrl.startsWith("http")
          ? post.imageUrl
          : `${base}${post.imageUrl}`
        : undefined;
      entries.push({
        url: `${base}/${locale}/blog/${post.slug}`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: {
          languages: {
            it: `${base}/it/blog/${post.slug}`,
            en: `${base}/en/blog/${post.slug}`,
            "x-default": `${base}/it/blog/${post.slug}`
          }
        },
        ...(imageUrl ? { images: [imageUrl] } : {})
      });
    }
  }

  // ─── Gallery items (public read-only items) ────────────────────────
  // GalleryItem has no `published` flag — admin-published items have
  // deletedAt = null, so we use that as the "public" gate.
  const galleryItems = await prisma.galleryItem.findMany({
    where: { deletedAt: null },
    select: { id: true, createdAt: true, src: true, titleIt: true, titleEn: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  for (const item of galleryItems) {
    if (!item.src) continue;
    const lastModified = item.createdAt ?? now;
    const imageUrl = item.src.startsWith("http") ? item.src : `${base}${item.src}`;
    for (const locale of locales) {
      entries.push({
        url: `${base}/${locale}/gallery#${item.id}`,
        lastModified,
        changeFrequency: "yearly",
        priority: 0.4,
        images: [imageUrl]
      });
    }
  }

  return entries;
}
