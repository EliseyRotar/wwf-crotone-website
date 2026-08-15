"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2, AlertTriangle, Layers, ZoomIn, ZoomOut } from "lucide-react";
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet";

type Locale = "it" | "en";

export type ActivitiesMapPoint = {
  id: string;
  lat: number;
  lng: number;
  titleIt: string;
  titleEn: string;
  bodyIt?: string;
  bodyEn?: string;
  badgeIt?: string;
  badgeEn?: string;
};

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; ' +
  '<a href="https://carto.com/attributions">CARTO</a>';

const FOCUS_BOUNDS_PADDING: [number, number] = [40, 40];

function detectDark(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains("dark")) return true;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Interactive Leaflet map with CARTO Voyager (light) / CARTO dark_all
 * (dark) basemap, locale-aware popups, and a chip-style legend that
 * flies the camera to each marker.
 *
 * Data-driven: pass the points you want to show.
 *
 * Props:
 *  - points: locations to render
 *  - locale: 'it' | 'en'
 *  - center/zoom: initial camera (defaults fit-bounds if omitted)
 */
export default function ActivitiesMap({
  points,
  locale = "it",
  center,
  zoom
}: {
  points: ActivitiesMapPoint[];
  locale?: "it" | "en";
  center?: [number, number];
  zoom?: number;
}) {
  const isIt = locale !== "en";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const popupsRef = useRef<Record<string, string>>({});

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>(points[0]?.id ?? "");

  // Build the popup HTML once per locale change so clicks open in the right language
  useEffect(() => {
    const out: Record<string, string> = {};
    for (const p of points) {
      const title = isIt ? p.titleIt : p.titleEn;
      const body = isIt ? (p.bodyIt ?? "") : (p.bodyEn ?? "");
      const badge = isIt ? (p.badgeIt ?? "") : (p.badgeEn ?? "");
      out[p.id] =
        `<div class="map-popup"><strong>${escapeHtml(title)}</strong>` +
        (badge ? `<p class="map-popup-badge">${escapeHtml(badge)}</p>` : "") +
        (body ? `<p>${escapeHtml(body)}</p>` : "") +
        `</div>`;
    }
    popupsRef.current = out;
  }, [isIt, points]);

  // Initialize the map on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = await import("leaflet");
        const iconRetina = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
        const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default;
        const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default;

        const proto = L.Icon.Default.prototype as unknown as Record<string, unknown>;
        if ("_getIconUrl" in proto) delete proto._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetina.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src
        });

        if (cancelled) return;
        const el = containerRef.current;
        if (!el) return;

        const dark = detectDark();
        const initialUrl = dark ? TILE_DARK : TILE_LIGHT;

        const initCenter = center ?? [39.0, 17.0];
        const initZoom = zoom ?? 9;
        const map = L.map(el, {
          center: initCenter,
          zoom: initZoom,
          scrollWheelZoom: false,
          attributionControl: true
        });
        const tile = L.tileLayer(initialUrl, {
          attribution: ATTRIBUTION,
          maxZoom: 19,
          crossOrigin: true
        }).addTo(map);
        tileRef.current = tile;
        mapRef.current = map;

        // Add markers
        points.forEach((p) => {
          const marker = L.marker([p.lat, p.lng], {
            title: isIt ? p.titleIt : p.titleEn,
            keyboard: true,
            alt: isIt ? p.titleIt : p.titleEn
          }).addTo(map);
          const popupHtml = popupsRef.current[p.id] ?? `<strong>${escapeHtml(p.titleIt)}</strong>`;
          marker.bindPopup(popupHtml, { closeButton: true, maxWidth: 280 });
          marker.on("click", () => setActiveId(p.id));
          markersRef.current[p.id] = marker;
        });

        // Fit bounds to all points unless explicit center was given
        if (!center) {
          const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
          map.fitBounds(bounds, { padding: FOCUS_BOUNDS_PADDING });
        }

        setReady(true);
      } catch (err) {
        console.error("ActivitiesMap init error:", err);
        if (!cancelled) setError("map-load-failed");
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileRef.current = null;
        markersRef.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the locale changes after init, update popup content
  useEffect(() => {
    if (!ready) return;
    for (const p of points) {
      const m = markersRef.current[p.id];
      if (!m) continue;
      const html = popupsRef.current[p.id];
      if (html) m.setPopupContent(html);
    }
  }, [isIt, ready, points]);

  // React to theme changes
  useEffect(() => {
    if (!ready || !mapRef.current || !tileRef.current) return;
    const onThemeChange = () => {
      const dark = detectDark();
      const url = dark ? TILE_DARK : TILE_LIGHT;
      tileRef.current?.setUrl(url);
    };
    const obs = new MutationObserver(onThemeChange);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => onThemeChange();
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else mq.addListener(onMq);
    return () => {
      obs.disconnect();
      if (mq.removeEventListener) mq.removeEventListener("change", onMq);
      else mq.removeListener(onMq);
    };
  }, [ready]);

  // When the user clicks a chip, fly to the marker and open its popup
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const m = markersRef.current[activeId];
    if (!m) return;
    mapRef.current.flyTo(m.getLatLng(), Math.max(mapRef.current.getZoom(), 11), { duration: 0.7 });
    m.openPopup();
  }, [activeId, ready]);

  const activePoint = useMemo(
    () => points.find((p) => p.id === activeId) ?? points[0],
    [activeId, points]
  );

  const zoomBy = (delta: number) => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() + delta);
  };

  return (
    <div className="card">
      <div className="card-body p-0 overflow-hidden">
        <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
          <div
            ref={containerRef}
            className="absolute inset-0"
            role="application"
            aria-label={
              isIt
                ? "Mappa interattiva delle attività del campo"
                : "Interactive map of camp activities"
            }
          />

          {/* Floating zoom + theme controls (top-right) */}
          {ready && (
            <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => zoomBy(1)}
                className="w-9 h-9 rounded-lg bg-white/95 dark:bg-ink/95 shadow-md hover:bg-white dark:hover:bg-ink-2 flex items-center justify-center text-ink-2 dark:text-white transition-colors"
                aria-label={isIt ? "Ingrandisci" : "Zoom in"}
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(-1)}
                className="w-9 h-9 rounded-lg bg-white/95 dark:bg-ink/95 shadow-md hover:bg-white dark:hover:bg-ink-2 flex items-center justify-center text-ink-2 dark:text-white transition-colors"
                aria-label={isIt ? "Rimpicciolisci" : "Zoom out"}
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => tileRef.current?.setUrl(detectDark() ? TILE_LIGHT : TILE_DARK)}
                className="w-9 h-9 rounded-lg bg-white/95 dark:bg-ink/95 shadow-md hover:bg-white dark:hover:bg-ink-2 flex items-center justify-center text-ink-2 dark:text-white transition-colors"
                aria-label={isIt ? "Cambia stile mappa" : "Toggle map style"}
                title={isIt ? "Cambia stile mappa" : "Toggle map style"}
              >
                <Layers size={16} />
              </button>
            </div>
          )}

          {!ready && !error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sand/80 dark:bg-ink/80 text-ink-2 dark:text-white text-sm"
              aria-live="polite"
            >
              <Loader2 size={28} className="animate-spin text-wwf-green" />
              <span>{isIt ? "Caricamento mappa…" : "Loading map…"}</span>
            </div>
          )}
          {error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sand/95 dark:bg-ink/95 text-ink-2 dark:text-white text-sm p-6 text-center"
              role="alert"
            >
              <AlertTriangle size={28} className="text-wwf-orange" />
              <span>
                {isIt
                  ? "Impossibile caricare la mappa. Verifica la connessione e riprova."
                  : "Could not load the map. Check your connection and try again."}
              </span>
            </div>
          )}
        </div>

        {activePoint && (
          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-wwf-green/10 text-wwf-green">
                <MapPin size={16} />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-lg leading-tight">
                  {isIt ? activePoint.titleIt : activePoint.titleEn}
                </h3>
                {(isIt ? activePoint.badgeIt : activePoint.badgeEn) && (
                  <p className="text-xs text-ink-grey mt-0.5">
                    {isIt ? activePoint.badgeIt : activePoint.badgeEn}
                  </p>
                )}
              </div>
            </div>
            {(isIt ? activePoint.bodyIt : activePoint.bodyEn) && (
              <p className="text-sm text-ink-2 leading-relaxed">
                {isIt ? activePoint.bodyIt : activePoint.bodyEn}
              </p>
            )}

            <ul className="flex flex-wrap gap-2 mt-5">
              {points.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(p.id)}
                    className={`tag transition-colors ${activeId === p.id ? "tag-green" : "tag-grey"}`}
                    aria-pressed={activeId === p.id}
                  >
                    {isIt ? p.titleIt : p.titleEn}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}