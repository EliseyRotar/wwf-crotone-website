"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet";

type Locale = "it" | "en";

type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  titleIt: string;
  titleEn: string;
  bodyIt: string;
  bodyEn: string;
  badgeIt: string;
  badgeEn: string;
};

const POINTS: MapPoint[] = [
  {
    id: "cela",
    lat: 38.9533,
    lng: 16.9747,
    titleIt: "C.E.L.A.",
    titleEn: "C.E.L.A. (Education Centre)",
    bodyIt: "Centro di Educazione alla Legalità e all'Ambiente. Ex bene confiscato alla mafia a San Leonardo di Cutro (KR): alloggio, cucina, sale comuni e base operativa del campo. A circa 200 m dalla spiaggia.",
    bodyEn: "Centre for Education in Legality and Environment. Former mafia-confiscated property in San Leonardo di Cutro (KR): accommodation, kitchen, common rooms and the camp's operational base. About 200 m from the beach.",
    badgeIt: "Alloggio",
    badgeEn: "Base camp"
  },
  {
    id: "caporizzuto",
    lat: 38.9086,
    lng: 17.0897,
    titleIt: "AMP Capo Rizzuto (Le Castella)",
    titleEn: "Capo Rizzuto MPA (Le Castella)",
    bodyIt: "Area Marina Protetta di Capo Rizzuto: spiaggia di monitoraggio e schiusa delle tartarughe marine Caretta caretta. Le attività principali del campo si svolgono qui.",
    bodyEn: "Capo Rizzuto Marine Protected Area: monitoring and hatching beach for Caretta caretta sea turtles. The main camp activities take place here.",
    badgeIt: "Spiaggia",
    badgeEn: "Beach"
  },
  {
    id: "crtm",
    lat: 38.9083,
    lng: 17.0906,
    titleIt: "CRTM Capo Rizzuto",
    titleEn: "CRTM Capo Rizzuto",
    bodyIt: "Centro Recupero Tartarughe Marine: i volontari partecipano alla manutenzione delle vasche, all'alimentazione e alle cure veterinarie di base prima del rilascio in mare.",
    bodyEn: "Sea Turtle Rescue Centre: volunteers help with tank maintenance, feeding and basic veterinary care before the turtles are released back to the sea.",
    badgeIt: "Recupero",
    badgeEn: "Rescue"
  },
  {
    id: "aquarium",
    lat: 39.0809,
    lng: 17.1305,
    titleIt: "Aquarium CEAM",
    titleEn: "Aquarium CEAM",
    bodyIt: "Acquario di Crotone dedicato alla fauna del Mar Ionio. Ospita quattro vasche per la cura delle tartarughe marine provenienti dal CRTM. I volontari ne curano la manutenzione e le visite guidate.",
    bodyEn: "Aquarium in Crotone dedicated to the Ionian Sea fauna. It hosts four tanks for the recovery of sea turtles coming from the CRTM. Volunteers take care of maintenance and guided tours.",
    badgeIt: "Divulgazione",
    badgeEn: "Outreach"
  },
  {
    id: "vergari",
    lat: 39.0983,
    lng: 16.7917,
    titleIt: "Riserva Naturale del Vergari",
    titleEn: "Vergari Nature Reserve",
    bodyIt: "Riserva naturale regionale nel comune di Mesoraca (KR): escursione naturalistica guidata durante il campo, tra i gioielli naturalistici del territorio crotonese.",
    bodyEn: "Regional nature reserve in the municipality of Mesoraca (KR): guided naturalistic excursion during the camp, one of the natural gems of the Crotone area.",
    badgeIt: "Escursione",
    badgeEn: "Excursion"
  },
  {
    id: "crotone",
    lat: 39.0792,
    lng: 17.1279,
    titleIt: "Crotone",
    titleEn: "Crotone",
    bodyIt: "Città di Crotone: punto di ritrovo, logistica arrivi e partenze dei volontari. Centro di riferimento per i trasporti (stazione, autostazione, aeroporto Sant'Anna).",
    bodyEn: "Town of Crotone: meeting point, arrival and departure logistics for volunteers. Main hub for transport (train, bus, Sant'Anna airport).",
    badgeIt: "Riferimento",
    badgeEn: "Reference"
  }
];

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; ' +
  '<a href="https://carto.com/attributions">CARTO</a> &middot; ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

const FOCUS_BOUNDS_PADDING: [number, number] = [40, 40];
const DEFAULT_CENTER: [number, number] = [39.0, 17.0];
const DEFAULT_ZOOM = 9;

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

export default function PastCampsMap({ locale = "it" }: { locale?: string }) {
  const isIt = locale !== "en";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const popupsRef = useRef<Record<string, string>>({});

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>(POINTS[0].id);

  // Build the popup HTML once per locale change so clicks open in the right language
  useEffect(() => {
    const out: Record<string, string> = {};
    for (const p of POINTS) {
      const title = isIt ? p.titleIt : p.titleEn;
      const body = isIt ? p.bodyIt : p.bodyEn;
      out[p.id] =
        `<div class="map-popup"><strong>${escapeHtml(title)}</strong>` +
        `<p>${escapeHtml(body)}</p></div>`;
    }
    popupsRef.current = out;
  }, [isIt]);

  // Initialize the map on mount (client-only via "use client").
  // We intentionally only run this once; locale-driven popup text is
  // refreshed in a separate effect below.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = await import("leaflet");
        // Leaflet looks for marker images via webpack/next; supply them explicitly
        const iconRetina = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
        const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default;
        const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default;

        // Standardise the default icon
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

        const map = L.map(el, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
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
        POINTS.forEach((p) => {
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

        // Fit bounds to all points
        const bounds = L.latLngBounds(POINTS.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: FOCUS_BOUNDS_PADDING });

        setReady(true);
      } catch (err) {
        console.error("map init error:", err);
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
    for (const p of POINTS) {
      const m = markersRef.current[p.id];
      if (!m) continue;
      const html = popupsRef.current[p.id];
      if (html) m.setPopupContent(html);
    }
  }, [isIt, ready]);

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
    () => POINTS.find((p) => p.id === activeId) ?? POINTS[0],
    [activeId]
  );

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
                ? "Mappa interattiva dei luoghi del campo"
                : "Interactive map of camp locations"
            }
          />
          {!ready && !error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sand/80 text-ink-2 text-sm"
              aria-live="polite"
            >
              <Loader2 size={28} className="animate-spin text-wwf-green" />
              <span>{isIt ? "Caricamento mappa…" : "Loading map…"}</span>
            </div>
          )}
          {error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sand/95 text-ink-2 text-sm p-6 text-center"
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

        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="shrink-0 mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-wwf-green/10 text-wwf-green">
              <MapPin size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-lg leading-tight">
                {isIt ? activePoint.titleIt : activePoint.titleEn}
              </h3>
              <p className="text-xs text-ink-grey mt-0.5">
                {isIt ? activePoint.badgeIt : activePoint.badgeEn}
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-2 leading-relaxed">
            {isIt ? activePoint.bodyIt : activePoint.bodyEn}
          </p>

          <ul className="flex flex-wrap gap-2 mt-5">
            {POINTS.map((p) => (
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
      </div>
    </div>
  );
}
