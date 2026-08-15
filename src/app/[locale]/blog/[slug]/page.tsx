import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/config/site";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: { titleIt: true, titleEn: true, excerptIt: true, excerptEn: true, imageUrl: true, published: true }
  });
  if (!post || !post.published) return {};

  const title = (locale === "en" && post.titleEn) ? post.titleEn : post.titleIt;
  const description = (locale === "en" && post.excerptEn) ? post.excerptEn : (post.excerptIt ?? title);

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/${locale}/blog/${slug}` },
    openGraph: {
      type: "article",
      title: `${title} · WWF Crotone`,
      description,
      url: `${baseUrl}/${locale}/blog/${slug}`,
      images: post.imageUrl ? [{ url: post.imageUrl, width: 1200, height: 630, alt: title }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.imageUrl ? [post.imageUrl] : undefined
    }
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = locale;

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: {
      titleIt: true,
      titleEn: true,
      contentIt: true,
      contentEn: true,
      excerptIt: true,
      excerptEn: true,
      imageUrl: true,
      published: true,
      publishedAt: true,
      authorId: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!post || !post.published) notFound();

  const title = loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt);
  const description =
    loc === "it"
      ? (post.excerptIt ?? post.titleIt)
      : (post.excerptEn ?? post.titleEn ?? post.titleIt);
  const url = `${baseUrl}/${loc}/blog/${slug}`;
  const ogLogo = `${baseUrl}/icon-192.png`;
  const datePublished = post.publishedAt?.toISOString() ?? post.createdAt.toISOString();
  const dateModified = post.updatedAt.toISOString();

  // Article JSON-LD: feeds Google rich results (title, image, date, author,
  // publisher) for individual blog posts. Falls back to SITE.name as author
  // when the authorId is not set.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    datePublished,
    dateModified,
    inLanguage: loc === "it" ? "it-IT" : "en-GB",
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      legalName: SITE.legalName,
      url: baseUrl,
      logo: { "@type": "ImageObject", url: ogLogo },
      sameAs: [SITE.facebook, SITE.instagram, SITE.googleBusiness].filter(Boolean)
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: {
      "@type": "Blog",
      name: loc === "it" ? "Blog WWF Crotone" : "WWF Crotone Blog",
      url: `${baseUrl}/${loc}/blog`
    }
  };
  if (post.imageUrl) {
    jsonLd.image = {
      "@type": "ImageObject",
      url: post.imageUrl.startsWith("http") ? post.imageUrl : `${baseUrl}${post.imageUrl}`,
      width: 1200,
      height: 630
    };
  }
  if (post.authorId) {
    jsonLd.author = { "@type": "Person", name: post.authorId };
    // TODO: replace with a real User lookup when admin UI exposes it
  } else {
    jsonLd.author = { "@type": "Organization", name: SITE.name };
  }

  return (
    <div className="container section max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        {post.imageUrl && (
          <div className="relative mb-6 overflow-hidden rounded-xl" style={{ aspectRatio: "16/9" }}>
            <Image
              src={post.imageUrl}
              alt={title}
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        )}
        {post.publishedAt && (
          <p className="text-sm text-ink-grey mb-2">{post.publishedAt.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        )}
        <h1 className="text-3xl md:text-4xl mb-6">{title}</h1>
        <div className="prose prose-lg max-w-none text-ink-2 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: loc === "it" ? post.contentIt : (post.contentEn ?? post.contentIt) }} />
      </article>
    </div>
  );
}