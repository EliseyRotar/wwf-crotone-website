import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages = ["", "about", "activities", "dates", "gallery", "faq", "contact", "privacy"];
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ["it", "en"]) {
    for (const p of pages) {
      entries.push({
        url: `${base}/${locale}/${p}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: p === "" ? 1 : 0.7,
        alternates: {
          languages: {
            it: `${base}/it/${p}`,
            en: `${base}/en/${p}`
          }
        }
      });
    }
  }
  return entries;
}