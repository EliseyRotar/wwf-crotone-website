import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "it" ? "Blog & News" : "Blog & News",
    description: locale === "it"
      ? "Aggiornamenti dai campi di volontariato WWF Crotone: nidi trovati, schiuse, eventi e progetti."
      : "Updates from the WWF Crotone volunteer camps: nests found, hatchings, events and projects.",
    alternates: { canonical: `${baseUrl}/${locale}/blog` }
  };
}

export const revalidate = 300;

export default async function BlogPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const loc = locale;
  const filter = sp.filter === "newsletter" ? "newsletter" : "all";

  // F12: Newsletter archive — posts whose slug starts with "newsletter-" or
  // whose title contains "Newsletter" are treated as newsletter entries.
  // No schema migration needed; this is a stable convention for the existing
  // BlogPost model.
  const allPosts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      titleIt: true,
      titleEn: true,
      excerptIt: true,
      excerptEn: true,
      imageUrl: true,
      publishedAt: true
    }
  });

  const isNewsletter = (slug: string, title: string) =>
    slug.toLowerCase().startsWith("newsletter-") || title.toLowerCase().includes("newsletter");

  const posts = filter === "newsletter"
    ? allPosts.filter((p) => isNewsletter(p.slug, p.titleIt) || isNewsletter(p.slug, p.titleEn ?? ""))
    : allPosts;

  return (
    <div className="container section max-w-4xl">
      <h1 className="mb-4">{loc === "it" ? "Blog & News" : "Blog & News"}</h1>
      <p className="text-ink-grey text-lg mb-6">
        {loc === "it" ? "Aggiornamenti dai campi di volontariato WWF Crotone." : "Updates from the WWF Crotone volunteer camps."}
      </p>

      <nav className="flex flex-wrap gap-2 mb-8" aria-label={loc === "it" ? "Filtra articoli" : "Filter posts"}>
        <a
          href={`/${loc}/blog`}
          className={`tag ${filter === "all" ? "tag-green" : "tag-grey"}`}
        >
          {loc === "it" ? "Tutti" : "All"}
        </a>
        <a
          href={`/${loc}/blog?filter=newsletter`}
          className={`tag ${filter === "newsletter" ? "tag-green" : "tag-grey"}`}
        >
          {loc === "it" ? "Archivio newsletter" : "Newsletter archive"}
        </a>
      </nav>

      {posts.length === 0 ? (
        <p className="text-ink-grey py-12 text-center">{loc === "it" ? "Nessun articolo ancora pubblicato." : "No articles published yet."}</p>
      ) : (
        <div className="grid gap-8">
          {posts.map((post) => {
            const nl = isNewsletter(post.slug, post.titleIt) || isNewsletter(post.slug, post.titleEn ?? "");
            return (
              <article key={post.id} className="card card-feature">
                {post.imageUrl && (
                  <div className="relative card-img">
                    <Image
                      src={post.imageUrl}
                      alt={loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)}
                      fill
                      sizes="(min-width: 1024px) 60vw, 100vw"
                      style={{ objectFit: "cover" }}
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="card-body">
                  {nl && (
                    <span className="tag tag-blue self-start">
                      {loc === "it" ? "Newsletter" : "Newsletter"}
                    </span>
                  )}
                  {post.publishedAt && (
                    <p className="text-xs text-ink-grey flex items-center gap-2 mb-2">
                      <Calendar size={12} /> {post.publishedAt.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <h2 className="text-xl mb-2">{loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)}</h2>
                  <p className="text-ink-2 mb-4 leading-relaxed">{loc === "it" ? (post.excerptIt ?? "") : (post.excerptEn ?? post.excerptIt ?? "")}</p>
                  <Link href={`/${loc}/blog/${post.slug}`} className="cta-text">
                    {loc === "it" ? "Leggi di più" : "Read more"} <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
