import type { LucideIcon } from "lucide-react";
import {
  Turtle,
  HeartPulse,
  Trash2,
  PawPrint,
  GraduationCap,
  Plane,
  Compass,
  BookOpen,
  Telescope,
  Sun,
  Building2,
  BookMarked,
  Sparkles,
  Users
} from "lucide-react";

/**
 * Shared shape for a single camp activity. Used by:
 *  - src/app/[locale]/page.tsx          (home — 6-card grid)
 *  - src/app/[locale]/activities/page.tsx (dedicated — full feature grid)
 *
 * Each activity carries an icon, an image, an optional geo-point, and
 * bilingual labels. Long-form copy lives in the i18n JSON files
 * (Activities.mainList / secondaryList / earthHourBody etc.) so the
 * page can render with the same body text the user already approves.
 */
export type Activity = {
  id: string;
  /** Lucide icon component (already imported at the top of this file). */
  icon: LucideIcon;
  /** Italian label. */
  it: string;
  /** English label. */
  en: string;
  /** Public gallery image, served from /public/images/gallery/. */
  img: string;
  /** Optional lat/lng for the activity map. */
  lat?: number;
  lng?: number;
  /** Optional external link (e.g. partner site). */
  href?: string;
};

/**
 * Six core activities. Order matters — the home page renders them in
 * this order in a 3-column grid, and the dedicated /activities page
 * reuses the same ordering.
 */
export const CORE_ACTIVITIES: Activity[] = [
  {
    id: "nests",
    icon: Turtle,
    it: "Ricerca nidi di Caretta caretta",
    en: "Search for Caretta caretta nests",
    img: "/images/gallery/ricerca_nidi.png",
    lat: 38.9086,
    lng: 17.0897
  },
  {
    id: "crtm",
    icon: HeartPulse,
    it: "Centro Recupero Tartarughe Marine",
    en: "Marine Turtle Recovery Center",
    img: "/images/gallery/tartaruga_nel_Centro_Recupero_Tartarughe_Marine.png",
    lat: 38.9083,
    lng: 17.0906
  },
  {
    id: "cleanup",
    icon: Trash2,
    it: "Pulizia delle spiagge",
    en: "Beach cleanup",
    img: "/images/gallery/pulizia_spiaggia.png",
    lat: 38.9086,
    lng: 17.0897
  },
  {
    id: "wildlife",
    icon: PawPrint,
    it: "Recupero animali selvatici",
    en: "Wildlife rescue",
    img: "/images/gallery/recupero_animali_selvatici.png",
    lat: 38.9403,
    lng: 16.9497
  },
  {
    id: "training",
    icon: GraduationCap,
    it: "Formazione sulle tartarughe marine",
    en: "Sea turtle training",
    img: "/images/gallery/drone_shot_beach_plus_sea.png",
    lat: 38.9533,
    lng: 16.9747
  },
  {
    id: "culture",
    icon: Plane,
    it: "Escursioni culturali",
    en: "Cultural excursions",
    img: "/images/gallery/Capocolonna.png",
    lat: 39.0809,
    lng: 17.1305
  }
];

/**
 * Five secondary activities. Rendered on the dedicated /activities
 * page inside a section-sand strip.
 */
export const SECONDARY_ACTIVITIES: Activity[] = [
  {
    id: "vergari",
    icon: Compass,
    it: "Escursione nella Riserva Naturale Regionale del Vergari (KR)",
    en: "Excursion to the Vergari Regional Nature Reserve (KR)",
    img: "/images/gallery/escursione_a_Mesoraca_con_le_conche_e_riserva_protetta.png",
    lat: 39.0983,
    lng: 16.7917,
    href: "https://www.riservanaturaledelvergari.it/"
  },
  {
    id: "capocolonna",
    icon: BookOpen,
    it: "Visita al Parco Archeologico e al Museo di Capocolonna (su prenotazione extra)",
    en: "Visit to the Capocolonna Archaeological Park and Museum (extra booking)",
    img: "/images/gallery/Capocolonna.png",
    lat: 39.0284,
    lng: 17.1769
  },
  {
    id: "castella",
    icon: Telescope,
    it: "Visita a Le Castella (isola di Capo Rizzuto), con possibile visita al Castello Aragonese",
    en: "Visit to Le Castella (Capo Rizzuto island), with optional visit to the Aragonese Castle",
    img: "/images/gallery/photo_citta_Le_Castella.png",
    lat: 38.9086,
    lng: 17.0897
  },
  {
    id: "events",
    icon: Sparkles,
    it: "Eventi di sensibilizzazione e eventi solidali",
    en: "Awareness and solidarity events",
    img: "/images/gallery/Spiaggia_allinterno_dellArea_Marina_Protetta_di_Capo_Rizzuto.png"
  },
  {
    id: "education",
    icon: Sun,
    it: "Educazione ambientale nelle spiagge dell'AMP",
    en: "Environmental education on the beaches of the MPA",
    img: "/images/gallery/photo_base_wwf_crotone.png",
    lat: 38.9403,
    lng: 16.9497
  }
];

/**
 * Three WWF Italia national events that volunteers can join. Rendered
 * on the dedicated /activities page in a 3-column feature-card grid.
 */
export const NATIONAL_EVENTS: Activity[] = [
  {
    id: "earth-hour",
    icon: Sparkles,
    it: "Earth Hour",
    en: "Earth Hour",
    img: "/images/gallery/schiusa_tartarughe.png"
  },
  {
    id: "urban-nature",
    icon: Building2,
    it: "Urban Nature",
    en: "Urban Nature",
    img: "/images/gallery/photo_base_wwf_crotone.png"
  },
  {
    id: "primavera-oasi",
    icon: Sun,
    it: "Primavera delle Oasi",
    en: "Primavera delle Oasi (Oases' Spring)",
    img: "/images/gallery/escursione_a_Mesoraca_con_le_conche_e_riserva_protetta.png"
  }
];

/**
 * Three training/education tracks. Rendered on the dedicated
 * /activities page in a section-sand 3-column grid.
 */
export const TRAINING_TRACKS: Activity[] = [
  {
    id: "internship",
    icon: Users,
    it: "Tirocini universitari e post-laurea",
    en: "University and postgraduate internships",
    img: "/images/gallery/photo_base_wwf_crotone.png"
  },
  {
    id: "courses",
    icon: BookMarked,
    it: "Corsi di formazione professionale",
    en: "Professional training courses",
    img: "/images/gallery/drone_shot_beach_plus_sea.png"
  },
  {
    id: "pcto",
    icon: GraduationCap,
    it: "Percorsi per le Competenze Trasversali e l'Orientamento (PCTO)",
    en: "Transversal Competences and Orientation Pathways (PCTO)",
    img: "/images/gallery/photo_base_wwf_crotone.png"
  }
];

/**
 * Selects every activity that has a geo-point. Used by the
 * /activities map (which reuses the PastCampsMap component).
 */
export function mappableActivities(): Activity[] {
  return [...CORE_ACTIVITIES, ...SECONDARY_ACTIVITIES].filter(
    (a): a is Activity & { lat: number; lng: number } =>
      typeof a.lat === "number" && typeof a.lng === "number"
  );
}