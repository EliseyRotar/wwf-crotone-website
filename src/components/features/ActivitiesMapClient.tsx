"use client";

import dynamic from "next/dynamic";
import type { ActivitiesMapPoint } from "@/components/features/ActivitiesMap";

/**
 * Client-only wrapper around ActivitiesMap. The underlying component
 * uses Leaflet which depends on `window`, so we lazy-load it on the
 * client to keep it out of the server bundle.
 */
const ActivitiesMap = dynamic(() => import("@/components/features/ActivitiesMap"), {
  ssr: false,
  loading: () => (
    <div className="card">
      <div className="card-body p-5 text-sm text-ink-2" style={{ minHeight: "320px" }}>
        <span aria-live="polite">Caricamento mappa…</span>
      </div>
    </div>
  )
});

export default function ActivitiesMapClient(props: {
  points: ActivitiesMapPoint[];
  locale?: string;
  center?: [number, number];
  zoom?: number;
}) {
  return <ActivitiesMap {...props} locale={props.locale as "it" | "en"} />;
}