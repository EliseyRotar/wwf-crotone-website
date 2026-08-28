import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import GalleryClient, { type GalleryItemData } from "@/components/features/GalleryClient";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Gallery" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: `${baseUrl}/${locale}/gallery` },
    openGraph: {
      title: `${t("title")} · WWF Crotone`,
      description: t("intro"),
      url: `${baseUrl}/${locale}/gallery`
    }
  };
}

export const revalidate = 300;

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Gallery");
  const tNav = await getTranslations("Nav");
  const loc = locale;

  const dbItems = await prisma.galleryItem.findMany({
    where: { deletedAt: null },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      src: true,
      thumbnail: true,
      titleIt: true,
      titleEn: true,
      captionIt: true,
      captionEn: true,
      category: true,
      year: true
    }
  });

  const items: GalleryItemData[] = dbItems.map((g) => ({
    id: g.id,
    type: (g.type as "image" | "video") ?? "image",
    src: g.src,
    thumbnail: g.thumbnail,
    titleIt: g.titleIt,
    titleEn: g.titleEn,
    captionIt: g.captionIt,
    captionEn: g.captionEn,
    category: g.category,
    year: g.year
  }));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tNav("home"), item: `${baseUrl}/${loc}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `${baseUrl}/${loc}/gallery` }
    ]
  };

  return (
    <div className="container section gallery-section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="breadcrumb" aria-label="breadcrumb">
        <ol>
          <li><a href={`/${loc}`}>{tNav("home")}</a></li>
          <li aria-current="page">{t("title")}</li>
        </ol>
      </nav>

      <h1 className="text-4xl md:text-5xl mb-5">{t("title")}</h1>
      <p className="text-lg text-ink-2 max-w-3xl mb-10 leading-relaxed">{t("intro")}</p>

      <GalleryClient items={items} />
    </div>
  );
}
