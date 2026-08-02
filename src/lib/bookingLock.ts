/**
 * Phase 2 — booking editability helpers for the volunteer personal area.
 *
 * Centralises the "is this field editable for this Iscrizione?" rules so
 * the API route, the server-rendered page, and any future admin override
 * can stay in sync.
 *
 * Two independent locks apply:
 *   1. `personalDataLockedAt` — set when the volunteer's identity has
 *      been verified by the admin (e.g. they've already arrived and
 *      handed in their documents). This locks ONLY the personal/contact
 *      fields and the consent block; logistics stays editable until the
 *      camp actually starts.
 *   2. The turno has started (Turno.startDate <= now). Once the camp is
 *      in progress, ALL fields are read-only — there's no point letting
 *      a volunteer edit "arrival time" while they're already on site.
 *
 * The combination is OR: if either lock applies, the field is locked.
 */

export type EditLockReason = "personal-data-locked" | "turno-started" | null;

export type IscrizioneForEdit = {
  personalDataLockedAt: Date | null;
  turno: { startDate: Date };
};

/**
 * The list of fields that get locked when `personalDataLockedAt` is
 * set. These are the "identity" / "consent" fields — anything that, if
 * changed silently, would create a paper trail problem. Everything
 * else (logistics, health, etc.) remains editable until the turno
 * actually starts.
 */
export const PERSONAL_DATA_FIELDS = [
  // Anagrafica
  "firstName",
  "lastName",
  "birthDate",
  "age",
  "email",
  "phone",
  "isMinor",
  // Guardian (minor's parent)
  "guardianName",
  "guardianEmail",
  "guardianPhone",
  "guardianConsent",
  // Consensi
  "privacyConsent",
  "marketingConsent",
  "imageDataConsent"
] as const;
export type PersonalDataField = (typeof PERSONAL_DATA_FIELDS)[number];

/**
 * Returns the reason a given field is locked, or null if it is editable.
 * Pure function — no DB calls — so it's safe to call from a server
 * component for a "view only" check.
 */
export function lockReasonFor(
  field: string,
  iscrizione: IscrizioneForEdit
): EditLockReason {
  if (iscrizione.turno?.startDate && iscrizione.turno.startDate.getTime() <= Date.now()) {
    return "turno-started";
  }
  if (
    iscrizione.personalDataLockedAt &&
    (PERSONAL_DATA_FIELDS as readonly string[]).includes(field)
  ) {
    return "personal-data-locked";
  }
  return null;
}

/**
 * Convenience: returns true when the volunteer can submit any edit at
 * all (i.e. at least one field is unlocked). Once the turno has
 * started, this returns false.
 */
export function canEditAnything(iscrizione: IscrizioneForEdit): boolean {
  if (iscrizione.turno?.startDate && iscrizione.turno.startDate.getTime() <= Date.now()) {
    return false;
  }
  return true;
}

/**
 * The set of fields the volunteer is allowed to edit from the
 * /account/bookings/[id] page. Currently mirrors
 * `PERSONAL_DATA_FIELDS` ∪ health ∪ logistics — everything except
 * admin-managed fields (status, notes, managedBy, deletedAt,
 * paymentIntentId, etc.).
 */
export const EDITABLE_FIELDS = [
  ...PERSONAL_DATA_FIELDS,
  // Health & diet
  "allergies",
  "medications",
  "swimmingAbility",
  "tetanusStatus",
  "fitnessSelf",
  "dietaryNeeds",
  "dietaryNotes",
  "tshirtSize",
  // Logistics
  "arrivalMode",
  "arrivalTime",
  "departureTime"
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Per-field type hints for zod validation in the API route. */
export const FIELD_LABELS: Record<string, { section: "anagrafica" | "salute" | "logistica" | "consensi"; label: string }> = {
  // Anagrafica
  firstName: { section: "anagrafica", label: "firstName" },
  lastName: { section: "anagrafica", label: "lastName" },
  birthDate: { section: "anagrafica", label: "birthDate" },
  age: { section: "anagrafica", label: "age" },
  email: { section: "anagrafica", label: "email" },
  phone: { section: "anagrafica", label: "phone" },
  isMinor: { section: "anagrafica", label: "isMinor" },
  guardianName: { section: "anagrafica", label: "guardianName" },
  guardianEmail: { section: "anagrafica", label: "guardianEmail" },
  guardianPhone: { section: "anagrafica", label: "guardianPhone" },
  guardianConsent: { section: "anagrafica", label: "guardianConsent" },
  // Salute
  allergies: { section: "salute", label: "allergies" },
  medications: { section: "salute", label: "medications" },
  swimmingAbility: { section: "salute", label: "swimmingAbility" },
  tetanusStatus: { section: "salute", label: "tetanusStatus" },
  fitnessSelf: { section: "salute", label: "fitnessSelf" },
  dietaryNeeds: { section: "salute", label: "dietaryNeeds" },
  dietaryNotes: { section: "salute", label: "dietaryNotes" },
  tshirtSize: { section: "salute", label: "tshirtSize" },
  // Logistica
  arrivalMode: { section: "logistica", label: "arrivalMode" },
  arrivalTime: { section: "logistica", label: "arrivalTime" },
  departureTime: { section: "logistica", label: "departureTime" },
  // Consensi
  privacyConsent: { section: "consensi", label: "privacyConsent" },
  marketingConsent: { section: "consensi", label: "marketingConsent" },
  imageDataConsent: { section: "consensi", label: "imageDataConsent" }
};
