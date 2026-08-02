"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search, X } from "lucide-react";

type Result = { type: "post" | "faq"; title: string; snippet: string; href: string };

/**
 * F8: Lightweight client-side search bar.
 * - ⌘K / Ctrl+K to open
 * - Esc to close
 * - Debounced fetch to /api/search
 */
export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("Nav");
  const locale = useLocale();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t_ = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, { signal: controller.signal });
        const json = await res.json();
        if (json.ok) setResults(json.results);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t_);
    };
  }, [q, locale]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 text-ink rounded-lg hover:bg-ink-grey-light/20 min-h-[44px] min-w-[44px] flex items-center gap-2"
        aria-label={t("search")}
        title="Cerca (⌘K)"
      >
        <Search size={18} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-start justify-center pt-20 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface w-full max-w-xl rounded-xl shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("search")}
          >
            <div className="flex items-center gap-2 border-b border-ink-grey-light/40 pb-2">
              <Search size={18} className="text-ink-grey" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="flex-1 bg-transparent outline-none text-base py-2"
                aria-label={t("search")}
              />
              <button onClick={() => setOpen(false)} className="p-1 text-ink-grey hover:text-ink" aria-label={t("searchClose")}>
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto mt-2">
              {loading && <p className="text-sm text-ink-grey px-2 py-3">{t("searchLoading")}</p>}
              {!loading && q.length >= 2 && results.length === 0 && (
                <p className="text-sm text-ink-grey px-2 py-3">{t("searchNoResults")}</p>
              )}
              {results.length > 0 && (
                <ul className="divide-y divide-ink-grey-light/30">
                  {results.map((r, idx) => (
                    <li key={idx}>
                      <button
                        onClick={() => go(r.href)}
                        className="w-full text-left px-2 py-3 hover:bg-sand transition-colors"
                      >
                        <p className="font-bold text-sm">
                          {r.type === "post" ? "📝" : "❓"} {r.title}
                        </p>
                        {r.snippet && <p className="text-xs text-ink-2 mt-1 line-clamp-2">{r.snippet}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[10px] text-ink-grey mt-2 text-right">⌘K · Esc</p>
          </div>
        </div>
      )}
    </>
  );
}
