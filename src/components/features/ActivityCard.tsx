import Image from "next/image";
import type { Activity } from "@/config/activities";
import { ExternalLink } from "lucide-react";

type Locale = "it" | "en";

/**
 * Shared activity card used on:
 *  - src/app/[locale]/page.tsx          (home — small card-feature grid)
 *  - src/app/[locale]/activities/page.tsx (dedicated — bigger, with body)
 *
 * Variants:
 *  - "feature"  → image + icon + label only (matches home page card)
 *  - "detailed" → image + icon + label + body text + optional CTA
 *
 * The body text comes from i18n (Activities.mainList / etc.) and is
 * matched by activity id, so the page author passes in a `bodies` map.
 */
export default function ActivityCard({
  a,
  locale,
  variant = "feature",
  body,
  cta
}: {
  a: Activity;
  locale: Locale;
  variant?: "feature" | "detailed";
  body?: string;
  cta?: { label: string; href: string };
}) {
  const label = locale === "it" ? a.it : a.en;
  const Icon = a.icon;
  const CardTag = cta ? "a" : "article";
  const cardProps = cta
    ? { href: cta.href, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <CardTag
      className={`card card-feature group ${cta ? "transition-transform hover:-translate-y-1" : ""}`}
      {...cardProps}
    >
      <div className="card-img">
        <Image
          src={a.img}
          alt={label}
          width={800}
          height={600}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          loading="lazy"
        />
      </div>
      <div className="card-body">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 rounded-lg bg-wwf-green/10 flex items-center justify-center ${
              variant === "detailed" ? "w-11 h-11" : "w-10 h-10"
            }`}
          >
            <Icon
              size={variant === "detailed" ? 22 : 20}
              className="text-wwf-green"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className={`leading-snug ${variant === "detailed" ? "text-xl mb-2" : "text-lg"}`}
            >
              {label}
              {cta && (
                <ExternalLink
                  size={14}
                  className="inline-block ml-1.5 -mt-1 text-wwf-green shrink-0"
                  aria-hidden
                />
              )}
            </h3>
            {body && variant === "detailed" && (
              <p className="text-sm text-ink-2 leading-relaxed">{body}</p>
            )}
            {cta && (
              <p className="text-xs text-ink-grey mt-2">
                {cta.label}
                <span className="ml-1 text-wwf-green">→</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </CardTag>
  );
}