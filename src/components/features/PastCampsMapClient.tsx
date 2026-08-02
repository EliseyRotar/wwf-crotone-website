"use client";

import dynamic from "next/dynamic";

/**
 * Client-only wrapper around PastCampsMap. The underlying component
 * uses Leaflet which depends on `window`, so we lazy-load it on the
 * client to keep it out of the server bundle.
 */
const PastCampsMap = dynamic(
  () => import("@/components/features/PastCampsMap"),
  {
    ssr: false,
    loading: () => (
      <div className="card">
        <div className="card-body p-5 text-sm text-ink-2" style={{ minHeight: "320px" }}>
          <span aria-live="polite">Caricamento mappa…</span>
        </div>
      </div>
    )
  }
);

export default function PastCampsMapClient(props: { locale?: string }) {
  return <PastCampsMap {...props} />;
}
