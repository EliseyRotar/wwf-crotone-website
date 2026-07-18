import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
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

export const dynamic = "force-dynamic";

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale;

  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" }
  });

  return (
    <div className="container section max-w-4xl">
      <h1 className="text-4xl md:text-5xl mb-3">{loc === "it" ? "Blog & News" : "Blog & News"}</h1>
      <p className="text-ink-2 mb-10">
        {loc === "it" ? "Aggiornamenti dai campi di volontariato WWF Crotone." : "Updates from the WWF Crotone volunteer camps."}
      </p>

      {posts.length === 0 ? (
        <p className="text-ink-grey">{loc === "it" ? "Nessun articolo ancora pubblicato." : "No articles published yet."}</p>
      ) : (
        <div className="grid gap-6">
          {posts.map((post) => (
            <article key={post.id} className="card">
              {post.imageUrl && (
                <div className="card-img" style={{ aspectRatio: "16/9" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.imageUrl} alt={loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)} />
                </div>
              )}
              <div className="card-body">
                {post.publishedAt && (
                  <p className="text-xs text-ink-grey flex items-center gap-1 mb-2">
                    <Calendar size={12} /> {post.publishedAt.toLocaleDateString(loc === "it" ? "it-IT" : "en-GB")}
                  </p>
                )}
                <h2 className="text-xl mb-2">{loc === "it" ? post.titleIt : (post.titleEn ?? post.titleIt)}</h2>
                <p className="text-sm text-ink-2 mb-3">{loc === "it" ? (post.excerptIt ?? "") : (post.excerptEn ?? post.excerptIt ?? "")}</p>
                <Link href={`/${loc}/blog/${post.slug}`} className="cta-text">
                  {loc === "it" ? "Leggi di più" : "Read more"} <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}