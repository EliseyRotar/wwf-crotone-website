"use client";

import { useState, useEffect } from "react";
import { Instagram } from "lucide-react";
import { useTranslations } from "next-intl";

interface InstaPost {
  id: string;
  media_url: string;
  permalink: string;
  caption?: string;
  media_type: string;
}

export default function InstagramFeed() {
  const t = useTranslations("Home");
  const tA = useTranslations("A11y");
  const [posts, setPosts] = useState<InstaPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsta() {
      try {
        const res = await fetch("/api/instagram");
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts?.slice(0, 6) ?? []);
        }
      } catch {
        // Instagram feed is optional
      } finally {
        setLoading(false);
      }
    }
    fetchInsta();
  }, []);

  if (loading) {
    return (
      <section className="section section-sand">
        <div className="container">
          <h2 className="text-2xl md:text-3xl mb-8 text-center">
            {t("instagramTitle")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-ink-grey-light/20 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="section section-sand">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl">
            {t("instagramTitle")}
          </h2>
          <a
            href="https://www.instagram.com/wwfcrotone/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-ink-grey hover:text-wwf-green transition-colors"
          >
            <Instagram size={20} />
            <span className="text-sm font-bold uppercase tracking-cta">@wwfcrotone</span>
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square block overflow-hidden rounded group relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.media_url}
                alt={post.caption?.slice(0, 100) ?? tA("instagramPostAlt")}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Instagram size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
