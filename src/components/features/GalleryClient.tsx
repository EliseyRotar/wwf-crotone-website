"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
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
  const lightboxRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    return filter === "all" ? items : items.filter((i) => i.category === filter);
  }, [items, filter]);

  const videoItems = useMemo(() => items.filter((i) => i.type === "video"), [items]);

  const openLightbox = useCallback((idx: number) => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    setLightbox(idx);
  }, []);

  const close = useCallback(() => {
    setLightbox(null);
    prevFocusRef.current?.focus();
  }, []);

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
      if (e.key === "Tab") {
        const el = lightboxRef.current;
        if (!el) return;
        const focusable = el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // iOS-safe scroll lock: pin body to current scroll position with position:fixed
    const scrollY = window.scrollY;
    const body = document.body;
    const prevBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.position = prevBodyStyles.position;
      body.style.top = prevBodyStyles.top;
      body.style.left = prevBodyStyles.left;
      body.style.right = prevBodyStyles.right;
      body.style.width = prevBodyStyles.width;
      body.style.overflow = prevBodyStyles.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [lightbox, close, prev, next]);

  useEffect(() => {
    if (lightbox !== null && lightboxRef.current) {
      const closeBtn = lightboxRef.current.querySelector("button") as HTMLElement;
      closeBtn?.focus();
    }
  }, [lightbox]);

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
      <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label={t("filterLabel")}>
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

      {filtered.length === 0 ? (
        <p className="text-ink-grey py-8 text-center">{t("noResults")}</p>
      ) : (
        <div className="masonry">
          {filtered.map((item, idx) => {
            const src = item.type === "video" ? (item.thumbnail ?? "/images/gallery/schiusa_tartarughe.png") : item.src;
            return (
              <button
                key={item.id}
                type="button"
                className="masonry-item group block w-full text-left"
                onClick={() => openLightbox(idx)}
                aria-label={title(item)}
              >
                <Image
                  src={src}
                  alt={title(item)}
                  width={800}
                  height={600}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading="lazy"
                  unoptimized={src.startsWith("http")}
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {title(item)}
                </span>
              </button>
            );
          })}
        </div>
      )}

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

      {lightbox !== null && filtered[lightbox] && (
        <div
          ref={lightboxRef}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={title(filtered[lightbox])}
          onClick={close}
        >
          <button className="absolute top-4 right-4 text-white p-2 z-10" aria-label={t("lightboxClose")} onClick={close}>
            <X size={28} />
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 z-10"
            aria-label={t("lightboxPrev")}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            <ChevronLeft size={36} />
          </button>
          <figure onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full">
            <Image
              src={filtered[lightbox].src}
              alt={title(filtered[lightbox])}
              width={1600}
              height={1200}
              sizes="100vw"
              unoptimized={filtered[lightbox].src.startsWith("http")}
              className="w-full h-auto"
            />
            <figcaption className="text-white/85 text-sm mt-3 text-center">
              {title(filtered[lightbox])}
              {caption(filtered[lightbox]) && <span className="block text-white/60 mt-1">{caption(filtered[lightbox])}</span>}
            </figcaption>
          </figure>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 z-10"
            aria-label={t("lightboxNext")}
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
