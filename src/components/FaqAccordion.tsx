"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="faq-item">
            <button
              type="button"
              className="faq-trigger"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <ChevronDown
                size={20}
                className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div id={`faq-panel-${i}`} className="faq-panel" role="region">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}