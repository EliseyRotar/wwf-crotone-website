export const SITE = {
  // Brand / display name — kept short for UI. The full legal name is in `legalName`.
  name: "WWF PROVINCIA DI CROTONE-ETS",

  // Legal identity (verbatim from the Statuto + Atto Costitutivo).
  legalName: "WWF PROVINCIA DI CROTONE-ETS",
  formaGiuridica: "Organizzazione di Volontariato (ODV) — D.Lgs. 117/2017",
  codiceFiscale: "91034580794",
  sedeLegale: "Località Marinella San Leonardo di Cutro, 88842 Cutro (KR), Calabria, Italia",
  presidente: "Paolo Asteriti",
  presidenteCf: "STRPLA75B18D122G",
  pec: "wwfcrotone@legalmail.it",

  // Subtitle shown under the brand name. "ODV" is the Italian legal form
  // (Organizzazione di Volontariato) and "ETS" stands for Ente del Terzo
  // Settore — both are required by D.Lgs. 117/2017 on public-facing materials.
  orgLineIt: "Organizzazione di Volontariato (ODV) — Ente del Terzo Settore",
  orgLineEn: "Volunteer Organisation (ODV) — Italian Third Sector Entity",

  // Public contacts
  email: "wwfcrotone26@gmail.com",
  phoneField: "+39 351 3945109",
  phonePaolo: "+39 328 8726625",
  facebook: "https://www.facebook.com/wwfcrotone",
  instagram: "https://www.instagram.com/wwfcrotone",
  googleBusiness: "https://www.google.com/maps/search/?api=1&query=WWF+Crotone",
  vergari: "https://www.riservanaturaledelvergari.it/",

  // Bank & docs
  iban: "IT30V0306909606100000107334",
  brochure: "/downloads/INFO_CAMPI_2026_WWF.pdf",

  // Domain
  domain: "wwfcrotone.it"
};

export const STATS = {
  turtles: 18000,
  nests: 2400,
  volunteers: 650,
  years: 20
} as const;
