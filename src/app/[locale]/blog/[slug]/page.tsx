import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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
      publishedAt: true
    }
  });
  if (!post || !post.published) notFound();

  return (
    <div className="container section max-w-3xl">
      <article>
        {post.imageUrl && (
          <div className="relative mb-6 overflow-hidden rounded-xl" style={{ aspectRatio: "16/9" }}>
            <Image
              src={post.imageUrl}
              alt={loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)}
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
        <h1 className="text-3xl md:text-4xl mb-6">{loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)}</h1>
        <div className="prose prose-lg max-w-none text-ink-2 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: loc === "it" ? post.contentIt : (post.contentEn ?? post.contentIt) }} />
      </article>
    </div>
  );
}