import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Approximate birthDate from age (camp year 2026)
function birthFromAge(age: number | null): Date {
  const year = 2026 - (age ?? 18);
  return new Date(`${year}-01-01`);
}

function isMinor(age: number | null): boolean {
  return age !== null && age < 18;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

type Row = {
  name: string;
  sex?: string;
  age?: number | null;
  email?: string;
  phone?: string;
  allergies?: string;
  notes?: string;
  paid?: string;
  guardianEmail?: string;
};

type CampData = { turn: number; rows: Row[] };

// Parsed from the Excel. Emails that say "email madre:" or "email di riferimento associazione:"
// are stored as guardianEmail when the volunteer is a minor, else as the main email.
const CAMPS: CampData[] = [
  {
    turn: 1,
    rows: [
      { name: "Elisey Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3519065041", paid: "Pagata il 09/03", guardianEmail: "oksanar2006@gmail.com" },
      { name: "Mohraeil Medhat", sex: "M", age: 18, email: "volontariato@associazionebir.it", phone: "3483479505", paid: "Pagata il 05/05" },
      { name: "Sofia Defeudis", sex: "F", age: 17, email: "volontariato@associazionebir.it", phone: "3513986426", paid: "Pagata il 05/05" },
      { name: "Alice Ficari", sex: "F", age: 24, email: "alice14febbraio@gmail.com", phone: "3277895287", paid: "Pagata il 18/06", allergies: "vegetariana" },
      { name: "Sofia ElFadly", sex: "F", age: 17, email: "volontariato@associazionebir.it", phone: "3756653787", paid: "Pagata il 05/05" },
      { name: "Sabrina Cekaj", sex: "F", age: 18, email: "volontariato@associazionebir.it", phone: "3711163487", paid: "Pagata il 05/05" },
      { name: "Miriana", sex: "F", age: 16, email: "", phone: "3883838957", paid: "No", allergies: "Acari della polvere" },
      { name: "Isabella Russo", sex: "F", age: 16, email: "", phone: "3514308494", paid: "No" }
    ]
  },
  {
    turn: 2,
    rows: [
      { name: "Elisey Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3519065041", paid: "Pagata il 09/03", guardianEmail: "oksanar2006@gmail.com" }
    ]
  },
  {
    turn: 3,
    rows: [
      { name: "Anna Lote Kirse", sex: "F", age: 14, email: "anna@sit.lv", phone: "37125429146", paid: "Pagata il 04/04" },
      { name: "Elena Sandra Pavulencko", sex: "F", age: 16, email: "ellkkwyy@gmail.com", phone: "37125595159", paid: "Pagata il 04/04" },
      { name: "Sofya Naumenko", sex: "F", age: 14, email: "naumenko.julia@gmail.com", phone: "37126302913", paid: "Pagata il 04/04" },
      { name: "Anita Colombo", sex: "F", age: 17, email: "barbarafossa@yahoo.it", phone: "3511535061", paid: "Pagata il 20/06" },
      { name: "Elisey Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3519065041", paid: "Rimane altre due settimane" }
    ]
  },
  {
    turn: 4,
    rows: [
      { name: "Eliott Le Pallec", sex: "M", age: 24, phone: "0491647180", paid: "" },
      { name: "Antoine Van Ro", sex: "M", age: 23, phone: "0476718879", paid: "" },
      { name: "Alexis Debecker", sex: "M", age: 24, phone: "0496242424", paid: "" },
      { name: "Olivia De Sousa Queiros", sex: "F", age: 22, phone: "0492208411", paid: "" },
      { name: "Elise Spinewine", sex: "F", age: 18, phone: "0494948910", paid: "" },
      { name: "Diego Taminiau", sex: "M", age: 17, phone: "0487298643", paid: "" },
      { name: "Esteban Garcia", sex: "M", age: 17, phone: "0477298314", paid: "" },
      { name: "Gabriel Lefèvre", sex: "M", age: 17, phone: "0474100303", paid: "" },
      { name: "Antoine Taminiau", sex: "M", age: 17, phone: "0455106356", paid: "" },
      { name: "Maxime Noclain", sex: "M", age: 17, phone: "0478062179", paid: "" },
      { name: "Thibaut Charton", sex: "M", age: 17, phone: "0484578245", paid: "" },
      { name: "Arthur Leonard", sex: "M", age: 16, phone: "0455124949", paid: "" },
      { name: "Martin Demaret", sex: "M", age: 16, phone: "0455124209", paid: "" },
      { name: "Thomas Delsemme", sex: "M", age: 16, phone: "0476865204", paid: "" },
      { name: "Alys Hasse", sex: "F", age: 16, phone: "0469106740", paid: "" },
      { name: "Charles Cardyn", sex: "M", age: 16, phone: "0455105894", paid: "" },
      { name: "Laura Taburiaux", sex: "F", age: 16, phone: "0492451512", paid: "" },
      { name: "Elisey Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3519065041", paid: "" }
    ]
  },
  {
    turn: 5,
    rows: [
      { name: "Mattia Grammatico", sex: "M", age: 15, email: "grammatico.matty@gmail.com", phone: "3807587700", paid: "Pagata il 07/04" },
      { name: "Lo Re Riccardo", sex: "M", age: 16, email: "riclore10@gmail.com", phone: "3516429312", paid: "Pagata il 08/04", notes: "madre 3389023175" },
      { name: "Simone Colombo", sex: "M", age: 15, email: "quadrani@libero.it", phone: "3280211094", paid: "Pagata il 18/04" },
      { name: "Diallo Boubacar", sex: "M", age: null, email: "margherita.ramacciotti@progettofragile.eu", phone: "3514157078", paid: "Pagata il 22/06" },
      { name: "Anna Preite", sex: "F", age: 18, email: "angyromano@libero.it", phone: "3274425972", paid: "No" },
      { name: "Alice Parente", sex: "F", age: 16, email: "rmoschetta@libero.it", phone: "3388373244", paid: "Si" }
    ]
  },
  {
    turn: 7,
    rows: [
      { name: "Giulia Bellanti", sex: "F", age: 31, email: "giuliabellanti@icloud.com", phone: "+393402703439", paid: "Si" },
      { name: "Eleonora Falletto", sex: "F", age: 22, email: "eleonora.falletto@gmail.com", phone: "3273019281", paid: "Si" },
      { name: "Chiara De Nicola", sex: "F", age: 28, email: "denicolachiara5@gmail.com", phone: "3385237472", paid: "Si" },
      { name: "Asia Evangelista", sex: "F", age: 18, email: "luca09372@gmail.com", phone: "3515037337", paid: "Si" },
      { name: "Michelle Tagliaferri", sex: "F", age: 24, email: "mjchelletagliaferri@gmail.com", phone: "3423832351", paid: "Si" },
      { name: "Valentina Ragone", sex: "F", age: null, email: "", phone: "3451838804", paid: "Si" },
      { name: "Alessandro Zoltan Messina", sex: "M", age: 27, email: "alessandro.messina99@gmail.com", phone: "3667068237", paid: "Si" },
      { name: "Sofia Colonnello", sex: "F", age: null, email: "", phone: "3336616941", paid: "Si" },
      { name: "Palmieri Elena", sex: "F", age: 30, email: "elena.palmieri17@gmail.com", phone: "3478182888", paid: "Si" }
    ]
  },
  {
    turn: 8,
    rows: [
      { name: "Giorgia Rizzo", sex: "F", age: 25, email: "giorgiar2001@gmail.com", phone: "3423649940", paid: "Pagata il 31/03" },
      { name: "Filippo Ettore Aldeghi", sex: "M", age: null, email: "", phone: "3347456079", paid: "Pagata il 19/05" },
      { name: "Valentina Ragone", sex: "F", age: null, email: "", phone: "3451838804", paid: "Si" },
      { name: "Sofia Colonnello", sex: "F", age: null, email: "", phone: "3336616941", paid: "Si" },
      { name: "Eric Stefan Miele", sex: "M", age: 31, email: "ericstefan.miele@protonmail.com", phone: "34008264032", paid: "Si" },
      { name: "Silvia Quintana", sex: "F", age: 44, email: "qui.sil@gmail.com", phone: "3289449035", paid: "Si" }
    ]
  },
  {
    turn: 9,
    rows: [
      { name: "Erica Schmidt", sex: "F", age: 42, email: "erica.schmidt@scuole.provincia.tn.it", phone: "3479542918", paid: "Pagata il 09/03" },
      { name: "Anna Merli", sex: "F", age: 11, email: "erica.schmidt@scuole.provincia.tn.it", phone: "3479542918", paid: "Pagata il 09/03", guardianEmail: "erica.schmidt@scuole.provincia.tn.it", notes: "Figlia di Erica Schmidt" },
      { name: "Alexander Eberle", sex: "M", age: 43, email: "alexander.eberle@hotmail.com", phone: "3286368676", paid: "Pagata il 07/04" },
      { name: "Giulio Eberle", sex: "M", age: 11, email: "alexander.eberle@hotmail.com", phone: "3286368676", paid: "Pagata il 07/04", guardianEmail: "alexander.eberle@hotmail.com", notes: "Figlio di Alexander Eberle" },
      { name: "Mattia Mannella", sex: "M", age: 21, email: "mannellamattia60@gmail.com", phone: "3392348311", paid: "Pagata il 20/05" },
      { name: "Filippo Ettero Aldeghi", sex: "M", age: 33, email: "aldeghifil@gmail.com", phone: "3347456079", paid: "Pagata il 19/05" },
      { name: "Anna Maria Perrone", sex: "F", age: 59, email: "amperrone67@gmail.com", phone: "3292652360", paid: "PAGATA IL 02/07" }
    ]
  },
  {
    turn: 10,
    rows: [
      { name: "Annalisa Anselmo", sex: "F", age: 47, email: "annalisa.anselmo.to@gmail.com", phone: "3483239585", paid: "Si" },
      { name: "Chiara Douard", sex: "F", age: 9, email: "annalisa.anselmo.to@gmail.com", phone: "", paid: "Si", guardianEmail: "annalisa.anselmo.to@gmail.com", notes: "Figlia di Annalisa Anselmo" },
      { name: "Alessandra Guzzo", sex: "F", age: null, email: "alexa.doc8@gmail.com", phone: "", paid: "Si pagata l'1/04" },
      { name: "Figlio Alessandra Guzzo", sex: "M", age: null, email: "alexa.doc8@gmail.com", phone: "", paid: "Si pagata l'1/04", guardianEmail: "alexa.doc8@gmail.com" },
      { name: "Alice Ferri", sex: "F", age: 23, email: "aliferri03@gmail.com", phone: "3662689214", paid: "Si pagata 02/04" },
      { name: "Andres Belloni", sex: "M", age: 16, email: "andresbelloni22@gmail.com", phone: "3899979691", paid: "Si pagata il 17/04/2026" },
      { name: "Giorgia De Zuani", sex: "F", age: 19, email: "giorgia.dezuani@studenti.unipd.it", phone: "3517998949", paid: "Si pagata il 23/04/2026" },
      { name: "Irene Comotti", sex: "F", age: 22, email: "comottiirene@gmail.com", phone: "3703075736", paid: "Si pagata il 03/04/2026" },
      { name: "Francesca Beatrice Passoni", sex: "F", age: 19, email: "passofra07@gmail.com", phone: "3512336179", paid: "Si pagata il 25/05/2026" },
      { name: "Elisa Mauro", sex: "F", age: 21, email: "easveli05@gmail.com", phone: "3451753994", paid: "Si pagata l'08/04" },
      { name: "Elisabetta Fella", sex: "F", age: null, email: "", phone: "", paid: "pagata il 25/06/2026", notes: "Partenza 30/08 AE Lamezia 10:30" },
      { name: "Anna Maria Perrone", sex: "F", age: 59, email: "amperrone67@gmail.com", phone: "3292652360", paid: "PAGATA IL 02/07" },
      { name: "Mari Kravchrnko", sex: "M", age: 17, email: "Sv22ks@gmail.com", phone: "3791815588", paid: "Si contanti", notes: "Lo accompagnano i genitori" }
    ]
  },
  {
    turn: 11,
    rows: [
      { name: "Laura Maria Truchetto", sex: "F", age: 21, email: "laura.truchetto.5@gmail.com", phone: "3398272622", paid: "Si pagata il 24/03" },
      { name: "Fella Elisabetta", sex: "F", age: 17, email: "bellaeli2805@gmail.com", phone: "3518814812", paid: "No" }
    ]
  }
];

function mapDiet(allergies?: string): { dietaryNeeds?: string; allergies?: string } {
  if (!allergies) return {};
  const lower = allergies.toLowerCase();
  if (lower.includes("vegetarian")) return { dietaryNeeds: "vegetarian" };
  if (lower.includes("vegan")) return { dietaryNeeds: "vegan" };
  if (lower.includes("celiac") || lower.includes("celiaco")) return { dietaryNeeds: "celiac" };
  // Otherwise treat as allergy info
  return { allergies };
}

function mapStatus(paid?: string): string {
  if (!paid) return "pending";
  const p = paid.toLowerCase();
  if (p.startsWith("si") || p.startsWith("pagata") || p.includes("contanti")) return "paid";
  if (p.startsWith("no")) return "pending";
  return "pending";
}

async function main() {
  console.log("Importing existing registrations...");

  // Clear existing imported-style registrations (those with notes containing "[import]")
  await prisma.iscrizione.deleteMany({ where: { notes: { contains: "[import]" } } });

  let count = 0;
  for (const camp of CAMPS) {
    const turno = await prisma.turno.findUnique({ where: { number: camp.turn } });
    if (!turno) {
      console.warn(`Turno ${camp.turn} not found, skipping.`);
      continue;
    }

    for (const row of camp.rows) {
      if (!row.name || !row.name.trim()) continue;
      const { first, last } = splitName(row.name);
      const minor = isMinor(row.age ?? null);
      const email = row.email || (row.phone ? `${cleanPhone(row.phone)}@import.local` : `import-${++count}@import.local`);
      const diet = mapDiet(row.allergies);

      const data = {
        firstName: first,
        lastName: last,
        birthDate: birthFromAge(row.age ?? null),
        email,
        phone: cleanPhone(row.phone || ""),
        isMinor: minor,
        guardianName: minor ? "Importato da Excel" : null,
        guardianEmail: row.guardianEmail ?? null,
        guardianPhone: null,
        guardianConsent: minor,
        turnoId: turno.id,
        allergies: diet.allergies ?? null,
        medications: null,
        swimmingAbility: null,
        tetanusStatus: null,
        fitnessSelf: null,
        dietaryNeeds: diet.dietaryNeeds ?? null,
        dietaryNotes: null,
        tshirtSize: null,
        arrivalMode: null,
        status: mapStatus(row.paid),
        notes: `[import] ${row.notes ?? ""}`.trim(),
        privacyConsent: true,
        marketingConsent: false,
        imageDataConsent: false
      };

      await prisma.iscrizione.create({ data });
      count++;
    }
  }

  console.log(`Imported ${count} existing registrations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });