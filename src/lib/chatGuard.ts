/**
 * Chat guard — multi-layer defense against prompt injection and off-topic
 * requests. Used by the public AI chat route to reject adversarial input
 * BEFORE it reaches the upstream model.
 *
 * Layers:
 *   1. Normalisation (collapse spaces, strip zero-width chars, lowercase)
 *   2. Injection-pattern regex (multilingual, typo-tolerant via Levenshtein-1)
 *   3. Off-topic keyword heuristic (Italian + English)
 *   4. Topic must contain at least one of N camp-related anchors OR be a
 *      short follow-up (greeting, "ok", "thanks") that we treat as
 *      conversation continuity
 *
 * Returns: { allowed: boolean; reason?: string }
 */

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

// Layers 1: normalise for matching. We do NOT mutate the original — that
// gets passed to the model.
function normalise(s: string): string {
  return s
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Layer 2: typo-tolerant Levenshtein-1 match against a list of dangerous
// phrases. Catches "ignroe", "insturctions", "preivous" etc.
function levenshtein1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  // Single substitution
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diffs++;
      if (diffs > 1) return false;
    }
    return diffs === 1;
  }
  // Single insertion/deletion — try both alignments
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
  }
  return false;
}

function fuzzyContains(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true;
  // Split haystack into words of length ±1 vs needle and compare
  const words = haystack.split(/\s+/);
  const needleWords = needle.split(/\s+/);
  if (needleWords.length === 1) {
    return words.some((w) => levenshtein1(w, needle));
  }
  // Sliding window: try every window of needleWords.length
  for (let i = 0; i <= words.length - needleWords.length; i++) {
    const window = words.slice(i, i + needleWords.length);
    if (window.every((w, j) => levenshtein1(w, needleWords[j]))) {
      return true;
    }
  }
  return false;
}

// Phrases that indicate a prompt injection attempt. We deliberately use
// natural-language fragments rather than full sentences so they survive
// paraphrasing.
const INJECTION_PHRASES = [
  // English
  "ignore previous instructions",
  "ignore all previous",
  "ignore the above",
  "ignore prior instructions",
  "disregard previous instructions",
  "disregard the system",
  "disregard all instructions",
  "disregard your instructions",
  "forget your instructions",
  "forget previous instructions",
  "forget everything",
  "reveal your prompt",
  "show your prompt",
  "show me your prompt",
  "reveal system prompt",
  "what are your instructions",
  "what is your system prompt",
  "repeat your prompt",
  "print your instructions",
  "repeat your instructions",
  "repeat the above",
  "new instructions",
  "override system",
  "bypass your rules",
  "break character",
  "ignore safety",
  "ignore content policy",
  "do not follow",
  "stop following",
  "act as",
  "pretend to be",
  "pretend you are",
  "you are now",
  "from now on",
  "system:",
  "assistant:",
  "<|im_start|>",
  "<|im_end|>",
  "developer mode",
  "jailbreak",
  "dan mode",
  "do anything now",
  // Italian
  "ignora istruzioni",
  "ignora le istruzioni",
  "ignora tutto",
  "ignora precedenti",
  "dimentica istruzioni",
  "mostrami il prompt",
  "rivela il prompt",
  "rivela le istruzioni",
  "ripeti le istruzioni",
  "stampa le istruzioni",
  "annulla sistema",
  "fingi di essere",
  "fai finta di essere",
  "da ora in poi",
  "modalità sviluppatore",
  "modalità dan"
];

// Layer 3: off-topic keyword heuristic. Matched on normalised text. The
// camp-anchor list is separate (see ALLOWED_TOPICS).
const OFFTOPIC_KEYWORDS = [
  // Recipes / food unrelated to camp
  "ricetta",
  "recipe",
  "torta",
  "cake",
  "biscotti",
  "cookies",
  "cioccolato",
  "chocolate",
  "pasta",
  "pizza",
  "dolce",
  "dessert",
  "cuoco",
  "cook",
  "kitchen",
  // Coding / programming
  "javascript",
  "typescript",
  "python",
  "rust",
  "golang",
  "java ",
  "c++",
  "function ",
  "algorithm",
  "codice sorgente",
  "source code",
  "compiler",
  "compilatore",
  // Off-topic chitchat
  "fidanzata",
  "fidanzato",
  "ragazza",
  "ragazzo",
  "girlfriend",
  "boyfriend",
  "matrimonio",
  "wedding",
  "oroscopo",
  "horoscope",
  "film ",
  "movie ",
  "netflix",
  "spotify",
  "calcio",
  "football match",
  "partita",
  // Homework / general knowledge
  "tesina",
  "compiti",
  "homework",
  "essay",
  "write an essay",
  "scrivi un tema",
  "history of",
  "storia di",
  "wikipedia",
  // Coding help
  "scrivere codice",
  "write code",
  "write a script",
  "regex pattern"
];

// Layer 4: camp-related anchors. A user message must contain at least one
// to be considered on-topic, OR be a short conversational continuation
// (handled separately).
const CAMP_ANCHORS = [
  // Italian
  "campo",
  "campi",
  "turno",
  "turni",
  "iscrizione",
  "iscrizioni",
  "prenotare",
  "prenota",
  "partecipare",
  "partecipa",
  "volontariato",
  "volontario",
  "volontari",
  "crotone",
  "wwf",
  "c.e.l.a",
  "cela",
  "tartaruga",
  "tartarughe",
  "caretta",
  "nido",
  "nidi",
  "spiaggia",
  "spiagge",
  "monitoraggio",
  "crtm",
  "ceam",
  "aquarium",
  "vergari",
  "capo rizzuto",
  "cutro",
  "san leonardo",
  "calabria",
  "iberia",
  "prezzo",
  "costo",
  "costa",
  "costano",
  "quota",
  "pagare",
  "bonifico",
  "iban",
  "sconto",
  "sconti",
  "borsa",
  "borsisti",
  "borsa di studio",
  "pcto",
  "alternanza",
  "tirocinio",
  "crediti",
  "cfu",
  "universit",
  "scuola",
  "studente",
  "studentessa",
  "minorenne",
  "minore",
  "minorenni",
  "genitore",
  "tutore",
  "assicurazione",
  "allergie",
  "allergia",
  "celiac",
  "vegano",
  "vegetarian",
  "vitto",
  "alloggio",
  "camerata",
  "stanza",
  "letto",
  "a castello",
  "arrivare",
  "arrivo",
  "partenza",
  "treno",
  "aereo",
  "autobus",
  "transfer",
  "lamezia",
  "cosa porto",
  "cosa portare",
  "cosa devo portare",
  "packing",
  "borsa",
  "zaino",
  "torcia",
  "repellente",
  "crema solare",
  "documenti",
  "passaporto",
  "carta d'identit",
  "tessera sanitaria",
  "schiusa",
  "schiusa",
  "tracce",
  "unità cinofila",
  "cinofila",
  "turtle dog",
  "tartamar",
  "antitetanica",
  "antitetan",
  "vaccinazione",
  "totò",
  "toto",
  "drone",
  "dragone",
  "recupero",
  "animali selvatici",
  "cras",
  "catanzaro",
  "lecce",
  "pulizia spiaggia",
  "pulizia spiagge",
  "legalit",
  "mafia",
  "bene confiscato",
  "riserva",
  "vergari",
  "mesoraca",
  "capocolonna",
  "le castella",
  "castello aragonese",
  "museo",
  "musei",
  "escursione",
  "escursioni",
  "attività",
  "attivita",
  "cucinare",
  "cucina",
  "menù",
  "menu",
  "colazione",
  "pranzo",
  "cena",
  // English
  "camp",
  "camps",
  "turn",
  "booking",
  "book",
  "register",
  "registration",
  "signup",
  "sign up",
  "apply",
  "volunteer",
  "volunteers",
  "volunteering",
  "crotone",
  "wwf",
  "turtle",
  "turtles",
  "caretta",
  "nest",
  "nests",
  "beach",
  "beaches",
  "monitoring",
  "crtm",
  "ceam",
  "aquarium",
  "vergari",
  "capo rizzuto",
  "calabria",
  "price",
  "cost",
  "fee",
  "payment",
  "discount",
  "scholarship",
  "pcto",
  "internship",
  "credit",
  "cfu",
  "university",
  "school",
  "student",
  "minor",
  "parent",
  "guardian",
  "insurance",
  "allergy",
  "allergies",
  "celiac",
  "vegan",
  "vegetarian",
  "meal",
  "meals",
  "food",
  "accommodation",
  "room",
  "bunk",
  "bed",
  "arrival",
  "departure",
  "train",
  "plane",
  "flight",
  "bus",
  "transfer",
  "lamezia",
  "what to bring",
  "what should i bring",
  "packing",
  "packing list",
  "torch",
  "flashlight",
  "repellent",
  "sunscreen",
  "passport",
  "id card",
  "health card",
  "hatch",
  "hatching",
  "tracks",
  "turtle dog",
  "toto",
  "drone",
  "rescue",
  "wildlife",
  "cras",
  "catanzaro",
  "beach cleanup",
  "beach clean",
  "legality",
  "mafia",
  "confiscated",
  "reserve",
  "mesoraca",
  "capocolonna",
  "le castella",
  "castle",
  "museum",
  "excursion",
  "excursions",
  "activity",
  "activities",
  "kitchen",
  "breakfast",
  "lunch",
  "dinner",
  // Common conversational — camp context (IT)
  "settimana", "settimane", "giorno", "giorni", "giornata", "giornate",
  "fare", "fanno", "programma", "orario", "orari", "organizzazione",
  "organizzato", "tipica", "tipico", "routine", "sveglia", "mattina",
  "pomeriggio", "sera", "notte", "doccia", "docce", "bagno", "bagni",
  "acqua", "calda", "fredda", "elettricit", "corrente", "wifi", "internet",
  "cellulare", "telefono", "copertura", "segnale", "lavatrice", "lavanderia",
  "supermercato", "negozio", "farmacia", "ospedale", "medico",
  "zanzare", "zanzara", "insetti", "serpenti", "animali", "pericoloso",
  "pericoli", "sicurezza", "sicuro", "gruppo", "gruppi", "età", "eta",
  "compagni", "persone", "ragazzi", "ragazze", "numero", "quanti", "quante",
  "posti", "disponibili", "disponibilit", "pieno", "posti liberi",
  "lingua", "lingue", "inglese", "italiano", "stranieri", "belga", "belgi",
  "francese", "tedesco", "spagnolo", "europa", "europei",
  "tempo", "meteo", "clima", "caldo", "freddo", "pioggia", "sole",
  "mare", "nuotare", "nuoto", "costume", "abbigliamento", "vestiti",
  "scarpe", "ciabatte", "infradito", "asciugamano", "lenzuola", "cuscino",
  "sacco a pelo", "materasso", "branda", "tenda", "campeggio",
  "struttura", "edificio", "base", "sede", "indirizzo",
  "dove", "quando", "come", "perché", "perche", "quale", "quali", "chi",
  "info", "informazioni", "contatti", "contatto", "email",
  "telefonare", "chiamare", "whatsapp", "social", "facebook", "instagram",
  "foto", "fotografie", "video", "certificato", "certificati",
  "modulo", "moduli", "liberatoria", "consenso", "privacy", "gdpr",
  "dati", "personali", "regolamento", "regole", "norme", "divieti",
  "vietato", "alcol", "alcool", "fumo", "fumare", "sigarette",
  "droga", "droghe", "animali domestici", "cane", "cani", "gatto",
  "check in", "check-in", "check out", "check-out",
  "ritrovo", "appuntamento", "stazione", "aeroporto", "porto",
  "navetta", "pullman", "macchina", "auto", "parcheggio", "parcheggiare",
  "conferma", "confermato", "lista d'attesa", "lista attesa", "waitlist",
  "cancellare", "cancellazione", "rimborso", "rimborsi",
  "pagamento", "pagamenti", "ricevuta", "fattura",
  "tessera", "tesseramento", "socio", "soci", "rinnovo",
  "quota associativa", "donazione", "donazioni", "sostenere", "sostegno",
  "adozione", "adotta", "simbolica", "gadget", "maglietta", "felpa", "cappello",
  // Common conversational — English
  "week", "weeks", "day", "days", "schedule", "timetable", "program",
  "routine", "typical", "morning", "afternoon", "evening", "night",
  "shower", "showers", "bathroom", "toilet", "water", "hot", "cold",
  "electricity", "power", "wifi", "internet", "phone", "signal", "coverage",
  "laundry", "supermarket", "shop", "pharmacy", "hospital", "doctor",
  "mosquito", "mosquitoes", "insects", "bugs", "snakes", "animals",
  "dangerous", "safety", "safe", "group", "groups", "age", "people",
  "kids", "number", "how many", "spots", "available", "availability",
  "full", "language", "languages", "english", "italian", "foreigners",
  "belgian", "french", "german", "spanish", "europe", "european",
  "weather", "climate", "rain", "sun", "sea", "swim", "swimming",
  "clothes", "clothing", "shoes", "slippers", "flip flops", "towel",
  "sheets", "pillow", "sleeping bag", "mattress", "tent", "camping",
  "building", "base", "address", "where", "when", "how", "why",
  "which", "who", "what", "info", "information", "contact", "contacts",
  "email", "call", "whatsapp", "social", "facebook", "instagram",
  "photos", "pictures", "video", "certificate", "form", "forms",
  "consent", "privacy", "gdpr", "data", "rules", "alcohol", "smoking",
  "smoke", "cigarettes", "drugs", "pets", "dog", "dogs", "cat",
  "check in", "check-in", "check out", "check-out", "meeting point",
  "station", "airport", "shuttle", "car", "parking", "confirmed",
  "waitlist", "cancel", "cancellation", "refund", "refunds",
  "receipt", "invoice", "membership", "member", "donation", "donate",
  "support", "adopt", "adoption", "merchandise", "tshirt", "hoodie", "hat"
];

// Short utterances that are conversation continuations, not new topics.
// "ok", "thanks", "perfect", "got it" etc. These are allowed even if
// they don't contain a camp anchor.
const CONTINUATION_PHRASES = new Set([
  "ok",
  "okay",
  "ok grazie",
  "va bene",
  "perfetto",
  "perfect",
  "great",
  "thanks",
  "thank you",
  "grazie",
  "grazie mille",
  "ciao",
  "hello",
  "hi",
  "hey",
  "salve",
  "buongiorno",
  "buonasera",
  "good morning",
  "good evening",
  "yes",
  "no",
  "si",
  "sì",
  "maybe",
  "forse"
]);

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function guardMessage(raw: string): GuardResult {
  const trimmed = raw.trim();
  if (!trimmed) return { allowed: false, reason: "empty" };

  // Short messages ≤ 4 words: if all words are continuations, allow.
  // Otherwise continue to other checks.
  const isShort = trimmed.split(/\s+/).length <= 4;
  const norm = normalise(trimmed);

  if (isShort && CONTINUATION_PHRASES.has(norm)) {
    return { allowed: true };
  }

  // Layer 2: injection detection (normalised + fuzzy)
  for (const phrase of INJECTION_PHRASES) {
    if (fuzzyContains(norm, phrase)) {
      return { allowed: false, reason: "injection-detected" };
    }
  }

  // Layer 3 + 4: topic classification
  const hasAnchor = CAMP_ANCHORS.some((a) => norm.includes(a));

  // Layer 3: off-topic keywords only reject if NO camp anchor is present.
  // This allows "Si può cucinare la pasta al campo?" (has "campo" anchor).
  if (!hasAnchor) {
    for (const kw of OFFTOPIC_KEYWORDS) {
      if (norm.includes(kw)) {
        return { allowed: false, reason: "off-topic" };
      }
    }
  }

  // If no anchor and not a continuation and not short-allowed → reject.
  if (!hasAnchor) {
    if (isShort) {
      // Allow only if every word is in continuations
      const words = norm.split(/\s+/);
      if (words.every((w) => CONTINUATION_PHRASES.has(w))) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: "off-topic" };
  }

  return { allowed: true };
}

// Detect off-topic replies coming BACK from the model. Defensive: if the
// upstream model misbehaves, we'd rather show a refusal than leak a
// recipe / homework answer to the user.
const REFUSAL_KEYWORDS = [
  // cooking
  "ingredienti",
  "ingredients",
  "istruzioni per",
  "instructions for",
  "forno",
  "oven",
  "mescola",
  "stir",
  "preriscalda",
  "preheat",
  // programming code blocks
  "function(",
  "console.log",
  "import {",
  "export const",
  "def main(",
  // essay / homework
  "in conclusion",
  "in conclusione",
  "## introduction"
];

export function guardResponse(raw: string): GuardResult {
  const norm = normalise(raw);
  for (const kw of REFUSAL_KEYWORDS) {
    if (norm.includes(kw)) {
      return { allowed: false, reason: "refusal-needed" };
    }
  }
  // If the response contains a code fence AND no camp anchor, reject.
  if (/```/.test(raw) && !CAMP_ANCHORS.some((a) => norm.includes(a))) {
    return { allowed: false, reason: "refusal-needed" };
  }
  return { allowed: true };
}
