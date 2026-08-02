"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Search,
  X,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  UserPlus,
  Car,
  HeartPulse,
  CreditCard,
  Compass,
  Sparkles,
  MessageCircle,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";

export type FaqItem = { q: string; a: string };
export type FaqCategory = {
  id: string;
  label: string;
  items: FaqItem[];
};

type Props =
  | { items: FaqItem[]; categories?: undefined; showSearch?: boolean; showFeedback?: boolean; contactHref?: string; showContact?: boolean }
  | { items?: undefined; categories: FaqCategory[]; showSearch?: boolean; showFeedback?: boolean; contactHref?: string; showContact?: boolean };

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  generale: HelpCircle,
  iscrizione: UserPlus,
  logistica: Car,
  salute: HeartPulse,
  pagamento: CreditCard,
  attivita: Compass,
  dopo: Sparkles
};

const FEEDBACK_KEY_PREFIX = "wwf-faq-feedback-";

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "ig");
  const lower = query.trim().toLowerCase();
  const parts = text.split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === lower ? (
      <mark key={i} className="faq-hl">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function safeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 60);
}

export default function FaqAccordion(props: Props) {
  const t = useTranslations("Faq");
  const {
    showSearch = true,
    showFeedback = true,
    showContact = true,
    contactHref = "/contact"
  } = props;

  const baseId = useId();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});

  const groups: FaqCategory[] = useMemo(() => {
    if (props.categories) return props.categories;
    return [{ id: "all", label: "", items: props.items }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.categories, props.items]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => activeCategory === "all" || g.id === activeCategory)
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter(
              (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)
            )
          : g.items
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query, activeCategory]);

  const totalResults = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.items.length, 0),
    [filteredGroups]
  );

  const itemKey = (cat: string, q: string) => `${cat}::${safeKey(q)}`;

  const toggle = (key: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFeedback = (key: string, value: "yes" | "no") => {
    setFeedback((prev) => ({ ...prev, [key]: value }));
    try {
      const stored = JSON.parse(localStorage.getItem(FEEDBACK_KEY_PREFIX + key) || "null");
      if (!stored || stored !== value) {
        localStorage.setItem(FEEDBACK_KEY_PREFIX + key, JSON.stringify(value));
      }
    } catch {
      /* noop */
    }
  };

  const expandAll = () => {
    const next = new Set<string>();
    filteredGroups.forEach((g) => g.items.forEach((it) => next.add(itemKey(g.id, it.q))));
    setOpenIds(next);
  };

  const collapseAll = () => setOpenIds(new Set());

  return (
    <div className="faq-shell">
      {showSearch && groups.length > 0 && (
        <div className="faq-toolbar">
          <div className="faq-search">
            <label htmlFor={`${baseId}-search`} className="sr-only">
              {t("searchLabel")}
            </label>
            <Search size={18} className="faq-search-icon" aria-hidden />
            <input
              id={`${baseId}-search`}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="faq-search-input"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="faq-search-clear"
                aria-label={t("searchClear")}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>

          {groups.length > 1 && (
            <div className="faq-chips" role="tablist" aria-label={t("allCategories")}>
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "all"}
                className={`faq-chip ${activeCategory === "all" ? "is-active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                {t("allCategories")}
                <span className="faq-chip-count">{groups.reduce((s, g) => s + g.items.length, 0)}</span>
              </button>
              {groups.map((g) => {
                const Icon = CATEGORY_ICONS[g.id];
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === g.id}
                    className={`faq-chip ${activeCategory === g.id ? "is-active" : ""}`}
                    onClick={() => setActiveCategory(g.id)}
                  >
                    {Icon && <Icon size={14} aria-hidden />}
                    {g.label}
                    <span className="faq-chip-count">{g.items.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="faq-toolbar-meta">
            <span aria-live="polite" className="faq-result-count">
              {t("resultCount", { count: totalResults })}
            </span>
            <div className="faq-expand-toggle">
              <button type="button" onClick={expandAll} className="faq-link-btn">
                {t("expandAll")}
              </button>
              <span aria-hidden>·</span>
              <button type="button" onClick={collapseAll} className="faq-link-btn">
                {t("collapseAll")}
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <div className="faq-empty">
          <Search size={32} className="faq-empty-icon" aria-hidden />
          <p className="faq-empty-title">{t("noResultsTitle")}</p>
          <p className="faq-empty-body">
            {t("noResultsBody", { query })}
          </p>
          {showContact && (
            <Link href={contactHref} className="btn btn-primary mt-4">
              <MessageCircle size={18} aria-hidden /> {t("contactCta")}
            </Link>
          )}
        </div>
      ) : (
        <div className="faq-categories">
          {filteredGroups.map((g) => {
            const Icon = CATEGORY_ICONS[g.id];
            return (
              <section key={g.id} className="faq-category" aria-labelledby={`${baseId}-cat-${g.id}`}>
                {g.label && (
                  <header className="faq-category-header">
                    {Icon && (
                      <span className="faq-category-icon" aria-hidden>
                        <Icon size={18} />
                      </span>
                    )}
                    <h3 id={`${baseId}-cat-${g.id}`} className="faq-category-title">
                      {g.label}
                    </h3>
                    <span className="faq-category-count">{g.items.length}</span>
                  </header>
                )}
                <ul className="faq-list">
                  {g.items.map((item, idx) => {
                    const key = itemKey(g.id, item.q);
                    const isOpen = openIds.has(key);
                    const panelId = `${baseId}-panel-${key}`;
                    const triggerId = `${baseId}-trigger-${key}`;
                    const fb = feedback[key];
                    return (
                      <li key={key} className="faq-item">
                        <div className={`faq-card ${isOpen ? "is-open" : ""}`}>
                          <h4 className="faq-q-heading">
                            <button
                              id={triggerId}
                              type="button"
                              className="faq-trigger"
                              aria-expanded={isOpen}
                              aria-controls={panelId}
                              onClick={() => toggle(key)}
                            >
                              <span className="faq-q-text">
                                {highlight(item.q, query)}
                              </span>
                              <ChevronDown
                                size={20}
                                className={`faq-chevron ${isOpen ? "is-rotated" : ""}`}
                                aria-hidden
                              />
                            </button>
                          </h4>
                          <div
                            id={panelId}
                            role="region"
                            aria-labelledby={triggerId}
                            className="faq-panel"
                            hidden={!isOpen}
                          >
                            <div className="faq-a">
                              {highlight(item.a, query)}
                            </div>
                            {showFeedback && (
                              <div className="faq-feedback">
                                {fb ? (
                                  <p className="faq-feedback-thanks" role="status">
                                    {fb === "yes"
                                      ? t("feedbackThanksYes")
                                      : t("feedbackThanksNo")}
                                  </p>
                                ) : (
                                  <>
                                    <p className="faq-feedback-prompt">{t("feedbackPrompt")}</p>
                                    <div className="faq-feedback-actions">
                                      <button
                                        type="button"
                                        className="faq-feedback-btn"
                                        onClick={() => handleFeedback(key, "yes")}
                                        aria-label={t("feedbackYes")}
                                      >
                                        <ThumbsUp size={16} aria-hidden />
                                        <span>{t("feedbackYes")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="faq-feedback-btn"
                                        onClick={() => handleFeedback(key, "no")}
                                        aria-label={t("feedbackNo")}
                                      >
                                        <ThumbsDown size={16} aria-hidden />
                                        <span>{t("feedbackNo")}</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {showContact && filteredGroups.length > 0 && (
        <aside className="faq-contact-cta">
          <div className="faq-contact-cta-inner">
            <MessageCircle size={28} className="faq-contact-icon" aria-hidden />
            <div className="faq-contact-text">
              <h3 className="faq-contact-title">{t("contactTitle")}</h3>
              <p className="faq-contact-body">{t("contactBody")}</p>
            </div>
            <Link href={contactHref} className="btn btn-green">
              {t("contactCta")}
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}
