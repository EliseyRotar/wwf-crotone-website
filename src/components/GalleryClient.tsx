"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type GalleryItemData = {
  id: string;
  type: "image" | "video";
  src: string;
  thumbnail?: string | null;
  titleIt: string;
  titleEn: string | null;
  captionIt: string | null;
  captionEn: string | null;
  category: string;
  year: number;
};

const CATS = ["all", "cleanup", "wildlife", "campo", "schiuse", "cultura", "crtm", "tartamar", "turtledog"] as const;
type Cat = (typeof CATS)[number];

export default function GalleryClient({ items }: { items: GalleryItemData[] }) {
  const t = useTranslations("Gallery");
  const locale = useLocale();
  const [filter, setFilter] = useState<Cat>("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const base = filter === "all" ? items : items.filter((i) => i.category === filter);
    return base;
  }, [items, filter]);

  const videoItems = useMemo(() => items.filter((i) => i.type === "video"), [items]);

  const close = useCallback(() => setLightbox(null), []);
  const prev = useCallback(
    () => setLightbox((v) => (v === null ? v : (v - 1 + filtered.length) % filtered.length)),
    [filtered.length]
  );
  const next = useCallback(
    () => setLightbox((v) => (v === null ? v : (v + 1) % filtered.length)),
    [filtered.length]
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, close, prev, next]);

  const filterLabels: Record<Cat, string> = {
    all: t("filterAll"),
    cleanup: t("filterCleanup"),
    wildlife: t("filterWildlife"),
    campo: t("filterCampo"),
    schiuse: t("filterSchiuse"),
    cultura: t("filterCultura"),
    crtm: t("filterCrtm"),
    tartamar: t("filterTartamar"),
    turtledog: t("filterTurtleDog")
  };

  const title = (it: GalleryItemData) => (locale === "en" && it.titleEn ? it.titleEn : it.titleIt);
  const caption = (it: GalleryItemData) =>
    locale === "en" && it.captionEn ? it.captionEn : it.captionIt;

  return (
    <>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="Filter">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={filter === c}
            onClick={() => setFilter(c)}
            className={`tag transition-colors ${
              filter === c ? "tag-green" : "tag-grey hover:bg-wwf-green-pale"
            }`}
          >
            {filterLabels[c]}
          </button>
        ))}
      </div>

      {/* Masonry grid */}
      {filtered.length === 0 ? (
        <p className="text-ink-grey">{t("noVideo")}</p>
      ) : (
        <div className="masonry">
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className="masonry-item group block w-full text-left"
              onClick={() => setLightbox(idx)}
              aria-label={title(item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.type === "video" ? (item.thumbnail ?? "/images/gallery/schiusa tartarughe.png") : item.src}
                alt={title(item)}
                loading="lazy"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {title(item)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Schiuse / video section */}
      <section className="mt-16" aria-label={t("schiuseTitle")}>
        <h2 className="text-2xl md:text-3xl mb-2">{t("schiuseTitle")}</h2>
        <p className="text-ink-2 mb-6 max-w-2xl">{t("schiuseIntro")}</p>
        {videoItems.length === 0 ? (
          <p className="text-ink-grey">{t("noVideo")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videoItems.map((v) => (
              <div key={v.id} className="aspect-video bg-ink">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.src}`}
                  title={title(v)}
                  className="w-full h-full"
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightbox !== null && filtered[lightbox] && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
          <button className="absolute top-4 right-4 text-white p-2" aria-label="Close" onClick={close}>
            <X size={28} />
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            <ChevronLeft size={36} />
          </button>
          <figure onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={filtered[lightbox].src} alt={title(filtered[lightbox])} />
            <figcaption className="text-white/85 text-sm mt-3 text-center">
              {title(filtered[lightbox])}
              {caption(filtered[lightbox]) && <span className="block text-white/60 mt-1">{caption(filtered[lightbox])}</span>}
            </figcaption>
          </figure>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            <ChevronRight size={36} />
          </button>
        </div>
      )}
    </>
  );
}