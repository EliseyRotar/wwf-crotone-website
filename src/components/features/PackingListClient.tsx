"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

const CATEGORY_KEYS = ["essentials", "clothing", "hygiene", "documents", "optional"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

export default function PackingListClient() {
  const t = useTranslations("PackingList");
  const tCat = useTranslations("PackingList.categories");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem("packing-list");
    if (stored) setChecked(JSON.parse(stored));
  }, []);

  const toggle = (item: string) => {
    setChecked((c) => {
      const next = { ...c, [item]: !c[item] };
      localStorage.setItem("packing-list", JSON.stringify(next));
      return next;
    });
  };

  const reset = () => {
    setChecked({});
    localStorage.removeItem("packing-list");
  };

  const totalItems = CATEGORY_KEYS.reduce(
    (acc, k) => acc + (t.raw(`items.${k}`) as unknown as string[]).length,
    0
  );
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="container section max-w-3xl">
      <h1 className="text-4xl md:text-5xl mb-3">{t("title")}</h1>
      <p className="text-ink-2 mb-4">
        {t("intro")}
      </p>
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-2 bg-ink-grey-light rounded-full overflow-hidden">
          <div className="h-full bg-wwf-green transition-all" style={{ width: `${(checkedCount / totalItems) * 100}%` }} />
        </div>
        <span className="text-sm font-bold text-ink-2">{checkedCount}/{totalItems}</span>
        <button onClick={reset} className="text-xs text-ink-grey hover:text-wwf-red">
          {t("reset")}
        </button>
      </div>

      <div className="space-y-6">
        {CATEGORY_KEYS.map((key) => {
          const items = t.raw(`items.${key}`) as unknown as string[];
          return (
            <div key={key}>
              <h2 className="text-lg mb-3 text-wwf-green" style={{ borderBottom: "2px solid #007932", paddingBottom: "4px" }}>{tCat(key)}</h2>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => toggle(item)}
                      className="flex items-center gap-3 w-full text-left py-2 px-3 rounded hover:bg-sand transition-colors"
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 border-2 rounded shrink-0 ${checked[item] ? "bg-wwf-green border-wwf-green" : "border-ink-grey-light"}`}>
                        {checked[item] && <Check size={14} className="text-white" />}
                      </span>
                      <span className={`text-sm ${checked[item] ? "text-ink-grey line-through" : "text-ink-2"}`}>{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}