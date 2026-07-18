import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = locale;

  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();

  return (
    <div className="container section max-w-3xl">
      <article>
        {post.imageUrl && (
          <div className="mb-6 overflow-hidden" style={{ aspectRatio: "16/9" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt={loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)} className="w-full h-full object-cover" />
          </div>
        )}
        {post.publishedAt && (
          <p className="text-sm text-ink-grey mb-2">{post.publishedAt.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB")}</p>
        )}
        <h1 className="text-3xl md:text-4xl mb-6">{loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)}</h1>
        <div className="prose prose-lg max-w-none text-ink-2 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: loc === "it" ? post.contentIt : (post.contentEn ?? post.contentIt) }} />
      </article>
    </div>
  );
}