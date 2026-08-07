// Seed data extracted from CAMPI_2026.xlsx (12 sheets, one per campo).
// Source: admin-provided paste. Numbers kept verbatim; missing fields omitted.
// Status: each registration is set to "confirmed" if bonifico is "sì" or
// registration fee is "pagata"; otherwise "pending".
//
// Operator lists are stored as Operatore rows with assignedTurns CSV.

export type ParticipantSeed = {
  firstName: string;
  lastName: string;
  sex: "M" | "F" | null;
  age: number | null;
  email: string | null;
  phone?: string | null;
  arrivalMode?: string;
  arrivalTime?: string;
  departureTime?: string;
  dietaryNeeds?: string;
  allergies?: string;
  notes?: string;
  feePaid?: boolean;
  feePaidDate?: string;
  bonifico?: boolean;
  isMinorInsurance?: boolean;
  imageDataConsent?: boolean;
};

export type OperatoreSeed = {
  firstName: string;
  // Operators are genderless here (their names appear without sex in the xlsx)
  notes?: string;
};

// One entry per (campo, operator name) — we dedupe to a single Operatore
// row with assignedTurns = CSV of Turno IDs.
export const OPERATORI: { name: string; turni: number[]; note?: string }[] = [
  // Luca: every campo (1-12)
  { name: "Luca", turni: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: "coordinatore" },
  // Lorenzo 1: 4, 5, 6, 7, 8, 9, 10, 11, 12 (note from xlsx: 'arrivo 15/07' in c4)
  { name: "Lorenzo 1", turni: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  // Lorenzo 2: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12
  { name: "Lorenzo 2", turni: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12] },
  // Luigi: 1-12 (all)
  { name: "Luigi", turni: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  // Carlo: 2-12 (arrival 01/07 noted in c2; appears from c3 onward)
  { name: "Carlo", turni: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  // Elena: 1-10 (not in c11 or c12 lists)
  { name: "Elena", turni: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  // Giulia: 1-12
  { name: "Giulia", turni: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  // Nadia: 3-12 (not in c1 or c2)
  { name: "Nadia", turni: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  // Nicola: 6-12 (appears from c6 onward)
  { name: "Nicola", turni: [6, 7, 8, 9, 10, 11, 12] }
];

export const CAMPI: {
  number: number;
  participants: ParticipantSeed[];
}[] = [
  {
    number: 1,
    participants: [
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3519065041", arrivalTime: "10:10", arrivalMode: "plane_crotone", notes: "Email della madre. Tessera SI", feePaid: true, feePaidDate: "2026-03-09", bonifico: true },
      { firstName: "Mohraeil", lastName: "Medhat", sex: "M", age: 18, email: "volontariato@associazionebir.it", phone: "3483479505", arrivalTime: "18:05", arrivalMode: "plane_crotone", departureTime: "18:25", notes: "Email di riferimento associazione. Tessera SI", feePaid: true, feePaidDate: "2026-05-05", bonifico: true },
      { firstName: "Sofia", lastName: "Defeudis", sex: "F", age: 17, email: "volontariato@associazionebir.it", phone: "3513986426", arrivalTime: "18:05", arrivalMode: "plane_crotone", departureTime: "18:25", notes: "Email di riferimento associazione. Minorenne, assicurazione non serve. Tessera SI", feePaid: true, feePaidDate: "2026-05-05", bonifico: true, isMinorInsurance: false },
      { firstName: "Alice", lastName: "Ficari", sex: "F", age: 24, email: "alice14febbraio@gmail.com", phone: "3277895287", arrivalTime: "18:25", arrivalMode: "own_car", departureTime: "18:25", notes: "Piazzale Nettuno Crotone. Vegetariana. Tessera SI", dietaryNeeds: "vegetarian", feePaid: true, feePaidDate: "2026-06-18", bonifico: true },
      { firstName: "Sofia", lastName: "ElFadly", sex: "F", age: 17, email: "volontariato@associazionebir.it", phone: "3756653787", arrivalTime: "18:05", arrivalMode: "plane_crotone", departureTime: "18:25", notes: "Minorenne, assicurazione non serve. Tessera SI", feePaid: true, feePaidDate: "2026-05-05", bonifico: true, isMinorInsurance: false },
      { firstName: "Sabrina", lastName: "Cekaj", sex: "F", age: 18, email: "volontariato@associazionebir.it", phone: "3711163487", arrivalTime: "18:05", arrivalMode: "plane_crotone", departureTime: "18:25", notes: "Tessera SI", feePaid: true, feePaidDate: "2026-05-05", bonifico: true },
      { firstName: "Miriana", lastName: "", sex: "F", age: 16, email: null, phone: "3883838957", arrivalTime: "18:00", arrivalMode: "own_car", notes: "Arriva autonomamente. Paga 150€ comprensivi di assicurazione minorenni", isMinorInsurance: true },
      { firstName: "Isabella", lastName: "Russo", sex: "F", age: 16, email: null, phone: "3514308494", arrivalTime: "18:00", arrivalMode: "own_car", allergies: "Acari della polvere", notes: "Arriva autonomamente. Paga 150€ comprensivi di assicurazione minorenni", isMinorInsurance: true }
    ]
  },
  {
    number: 2,
    participants: [
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3519065041", notes: "Proseguimento dal Campo 1. Email della madre", feePaid: true, feePaidDate: "2026-03-09", bonifico: true },
      { firstName: "Mohraeil", lastName: "Medhat", sex: "M", age: 18, email: "volontariato@associazionebir.it", phone: "3483479505", departureTime: "18:25", arrivalMode: "plane_crotone", notes: "Proseguimento. Partenza 03/07 AE Crotone", feePaid: true, feePaidDate: "2026-05-05", bonifico: true },
      { firstName: "Sofia", lastName: "Defeudis", sex: "F", age: 17, email: "volontariato@associazionebir.it", phone: "3513986426", departureTime: "18:25", arrivalMode: "plane_crotone", notes: "Proseguimento. Partenza 03/07 AE Crotone. Minorenne", feePaid: true, feePaidDate: "2026-05-05", bonifico: true, isMinorInsurance: false },
      { firstName: "Sabrina", lastName: "Cekaj", sex: "F", age: 18, email: "volontariato@associazionebir.it", phone: "3711163487", departureTime: "18:25", arrivalMode: "plane_crotone", notes: "Proseguimento. Partenza 03/07 AE Crotone", feePaid: true, feePaidDate: "2026-05-05", bonifico: true },
      { firstName: "Miriana", lastName: "", sex: "F", age: 16, email: null, phone: "3883838957", notes: "Proseguimento. Paga 150€ comprensivi ass. minorenni", isMinorInsurance: true },
      { firstName: "Isabella", lastName: "Russo", sex: "F", age: 16, email: null, phone: "3514308494", allergies: "Acari della polvere", notes: "Proseguimento. Paga 150€ comprensivi ass. minorenni", isMinorInsurance: true }
    ]
  },
  {
    number: 3,
    participants: [
      { firstName: "Anna Lote", lastName: "Kirse", sex: "F", age: 14, email: "anna@sit.lv", phone: "37125429146", notes: "Minorenne", feePaid: true, feePaidDate: "2026-04-04", bonifico: true, isMinorInsurance: false },
      { firstName: "Elena Sandra", lastName: "Pavulencko", sex: "F", age: 16, email: "ellkkwyy@gmail.com", phone: "37125595159", notes: "Minorenne", feePaid: true, feePaidDate: "2026-04-04", bonifico: true, isMinorInsurance: false },
      { firstName: "Sofya", lastName: "Naumenko", sex: "F", age: 14, email: "naumenko.julia@gmail.com", phone: "37126302913", notes: "Minorenne", feePaid: true, feePaidDate: "2026-04-04", bonifico: true, isMinorInsurance: false },
      { firstName: "Anita", lastName: "Colombo", sex: "F", age: 17, email: "barbarafossa@yahoo.it", phone: "3511535061", arrivalTime: "18:05", arrivalMode: "plane_crotone", notes: "Minorenne. Arrivo 05/07 AE Crotone", feePaid: true, feePaidDate: "2026-06-20", bonifico: true, isMinorInsurance: false },
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: null, phone: "3313444410", notes: "Rimane altre due settimane. Prosegue dal Campo 2", feePaid: true, bonifico: true }
    ]
  },
  {
    number: 4,
    participants: [
      { firstName: "Eliott", lastName: "Le Pallec", sex: "M", age: 24, email: null, phone: "+32491647180", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Arrivo 11/07 AE Crotone" },
      { firstName: "Antoine", lastName: "Van Ro", sex: "M", age: 23, email: null, phone: "+32476718879", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Arrivo 11/07 AE Crotone" },
      { firstName: "Alexis", lastName: "Debecker", sex: "M", age: 24, email: null, phone: "+32496242424", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Arrivo 11/07 AE Crotone" },
      { firstName: "Olivia", lastName: "De Sousa Queiros", sex: "F", age: 22, email: null, phone: "+32492208411", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Arrivo 11/07 AE Crotone" },
      { firstName: "Elise", lastName: "Spinewine", sex: "F", age: 18, email: null, phone: "+32494948910", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Arrivo 11/07 AE Crotone" },
      { firstName: "Diego", lastName: "Taminiau", sex: "M", age: 17, email: null, phone: "+32487298643", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Esteban", lastName: "Garcia", sex: "M", age: 17, email: null, phone: "+32477298314", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Gabriel", lastName: "Lefèvre", sex: "M", age: 17, email: null, phone: "+32474100303", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Antoine", lastName: "Taminiau", sex: "M", age: 17, email: null, phone: "+32455106356", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Maxime", lastName: "Noclain", sex: "M", age: 17, email: null, phone: "+32478062179", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Thibaut", lastName: "Charton", sex: "M", age: 17, email: null, phone: "+32484578245", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Arthur", lastName: "Leonard", sex: "M", age: 16, email: null, phone: "+32455124949", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Martin", lastName: "Demaret", sex: "M", age: 16, email: null, phone: "+32455124209", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Thomas", lastName: "Delsemme", sex: "M", age: 16, email: null, phone: "+32476865204", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Alys", lastName: "Hasse", sex: "F", age: 16, email: null, phone: "+32469106740", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Charles", lastName: "Cardyn", sex: "M", age: 16, email: null, phone: "+32455105894", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Laura", lastName: "Taburiaux", sex: "F", age: 16, email: null, phone: "+32492451512", arrivalTime: "11:30", arrivalMode: "plane_crotone", notes: "Gruppo belga. Minorenne. Arrivo 11/07 AE Crotone", isMinorInsurance: false },
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: null, phone: "3313444410", notes: "Prosegue dal Campo 3", feePaid: true, bonifico: true }
    ]
  },
  {
    number: 5,
    participants: [
      { firstName: "Mattia", lastName: "Grammatico", sex: "M", age: 15, email: "grammatico.matty@gmail.com", phone: "3807587700", arrivalTime: "15:16", arrivalMode: "train", notes: "Stazione Lamezia. Minorenne", feePaid: true, feePaidDate: "2026-04-07", bonifico: true, isMinorInsurance: true },
      { firstName: "Lo Re", lastName: "Riccardo", sex: "M", age: 16, email: "riclore10@gmail.com", phone: "3516429312", arrivalTime: "15:16", arrivalMode: "train", notes: "Stazione Lamezia. Minorenne. Madre: 3389023175", feePaid: true, feePaidDate: "2026-04-08", bonifico: true, isMinorInsurance: true },
      { firstName: "Simone", lastName: "Colombo", sex: "M", age: 15, email: "quadrani@libero.it", phone: "3280211094", arrivalTime: "17:30", arrivalMode: "train", notes: "Stazione Lamezia. Minorenne", feePaid: true, feePaidDate: "2026-07-13", bonifico: true, isMinorInsurance: true },
      { firstName: "Diallo", lastName: "Boubacar", sex: "M", age: 21, email: "boubamilano05@gmail.com", phone: "3514157078", arrivalTime: "17:43", arrivalMode: "train", departureTime: "10:20", notes: "Stazione Lamezia", feePaid: true, feePaidDate: "2026-06-22", bonifico: true },
      { firstName: "Anna", lastName: "Preite", sex: "F", age: 18, email: "angyromano@libero.it", phone: "3274425972", arrivalTime: "15:30", arrivalMode: "train", notes: "Stazione Lamezia", feePaid: true, bonifico: true, isMinorInsurance: true },
      { firstName: "Alice", lastName: "Parente", sex: "F", age: 16, email: "rmoschetta@libero.it", phone: "3388373244", arrivalTime: "15:30", arrivalMode: "train", notes: "Stazione Lamezia. Minorenne", feePaid: true, bonifico: true, isMinorInsurance: true },
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: null, phone: "3313444410", feePaid: true, bonifico: true },
      { firstName: "Miriana", lastName: "", sex: "F", age: 16, email: null, phone: "3883838957", arrivalTime: "19:00", arrivalMode: "own_car", notes: "Arriva autonomamente 19/07. Paga solo 30", feePaid: true }
    ]
  },
  {
    number: 6,
    participants: [
      { firstName: "Davide", lastName: "Ventura", sex: "M", age: 26, email: "ventu.dvd@gmail.com", phone: "3274398295", arrivalTime: "11:19", arrivalMode: "train", departureTime: "15:30", notes: "Stazione Crotone", feePaid: true, feePaidDate: "2026-05-27", bonifico: true },
      { firstName: "Andrea", lastName: "La Greca", sex: "M", age: 15, email: null, phone: null, arrivalMode: "own_car", notes: "Arriva in autonomia. Minorenne. Tassa confermata via WhatsApp", feePaid: true, bonifico: true, isMinorInsurance: true },
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: null, phone: "3313444410" },
      { firstName: "Miriana", lastName: "", sex: "F", age: 16, email: null, phone: "3883838957", notes: "Pagati 30. Data indicata 19/07" },
      { firstName: "Carlotta", lastName: "", sex: "F", age: null, email: null, phone: null, notes: "Nessun altro dato compilato" }
    ]
  },
  {
    number: 7,
    participants: [
      { firstName: "Giulia", lastName: "Bellanti", sex: "F", age: 31, email: "giuliabellanti@icloud.com", phone: "3402703439", arrivalTime: "07:55", arrivalMode: "bus", departureTime: "11:55", dietaryNeeds: "vegetarian", notes: "Autostazione Crotone. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Eleonora", lastName: "Falletto", sex: "F", age: 22, email: "eleonora.falletto@gmail.com", phone: "3273019281", arrivalTime: "11:40", arrivalMode: "plane_crotone", notes: "Aeroporto Crotone", feePaid: true, bonifico: true },
      { firstName: "Chiara", lastName: "De Nicola", sex: "F", age: 29, email: "denicolachiara5@gmail.com", phone: "3385237472", arrivalTime: "07:55", arrivalMode: "bus", departureTime: "11:55", dietaryNeeds: "vegetarian", notes: "Autostazione Crotone. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Asia", lastName: "Evangelista", sex: "F", age: 18, email: "luca09372@gmail.com", phone: "3515037337", arrivalTime: "07:55", arrivalMode: "bus", departureTime: "11:55", notes: "Autostazione Crotone. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Michelle", lastName: "Tagliaferri", sex: "F", age: 24, email: "mjchelletagliaferri@gmail.com", phone: "3423832351", arrivalTime: "10:10", arrivalMode: "plane_crotone", departureTime: "10:35", dietaryNeeds: "vegetarian", notes: "Aeroporto Crotone", feePaid: true, bonifico: true },
      { firstName: "Valentina", lastName: "Ragone", sex: "F", age: 25, email: null, phone: "3451838804", arrivalTime: "13:16", arrivalMode: "train", notes: "Stazione Lamezia. Bonifico no", feePaid: true },
      { firstName: "Alessandro Zoltan", lastName: "Messina", sex: "M", age: 27, email: "alessandro.messina99@gmail.com", phone: "3667068237", arrivalTime: "13:16", arrivalMode: "train", departureTime: "10:15", notes: "Stazione Lamezia. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Elena", lastName: "Palmieri", sex: "F", age: 30, email: "elena.palmieri17@gmail.com", phone: "3478182888", arrivalTime: "19:10", arrivalMode: "plane_lamezia", notes: "Aeroporto Lamezia. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Elisey", lastName: "Rotar", sex: "M", age: 18, email: "oksanar2006@gmail.com", phone: "3313444410", arrivalTime: "12:00", arrivalMode: "plane_crotone", departureTime: "16:15", notes: "Partenza 04/08 AE Crotone. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Alessandra Sofia", lastName: "Conte", sex: "F", age: 21, email: "conteale50@gmail.com", phone: "3277582910", arrivalTime: "10:30", arrivalMode: "train", departureTime: "12:20", dietaryNeeds: "vegetarian", notes: "Stazione Lamezia. Tessera SI. Liberatoria fotografie SI", feePaid: true, bonifico: true, imageDataConsent: true },
      { firstName: "Giulia", lastName: "", sex: "F", age: null, email: null, phone: null, notes: "Nessun altro dato compilato" }
    ]
  },
  {
    number: 8,
    participants: [
      { firstName: "Giorgia", lastName: "Rizzo", sex: "F", age: 25, email: "giorgiar2001@gmail.com", phone: "3423649940", arrivalTime: "11:20", arrivalMode: "train", notes: "Stazione di Crotone", feePaid: true, feePaidDate: "2026-03-31" },
      { firstName: "Filippo Ettore", lastName: "Aldeghi", sex: "M", age: null, email: null, phone: "3347456079", arrivalTime: "10:30", arrivalMode: "plane_crotone", notes: "Aeroporto Crotone", feePaid: true, feePaidDate: "2026-05-19" },
      { firstName: "Valentina", lastName: "Ragone", sex: "F", age: null, email: null, phone: "3451838804", notes: "Bonifico no", feePaid: true },
      { firstName: "Sofia", lastName: "Colonnello", sex: "F", age: null, email: null, phone: "3336616941", feePaid: true, bonifico: true },
      { firstName: "Eric Stefan", lastName: "Miele", sex: "M", age: 31, email: "ericstefan.miele@protonmail.com", phone: "34008264032", feePaid: true },
      { firstName: "Silvia", lastName: "Quintana", sex: "F", age: 44, email: "qui.sil@gmail.com", phone: "3289449035", feePaid: true },
      { firstName: "Pitar", lastName: "Kamarashev", sex: "M", age: null, email: null, phone: null, notes: "Tassa confermata via WhatsApp insieme a Erica", feePaid: true },
      { firstName: "Erica", lastName: "Colapinto", sex: "F", age: null, email: null, phone: null, notes: "Tassa confermata via WhatsApp insieme a Pitar", feePaid: true },
      { firstName: "Marina", lastName: "Galeandro", sex: "F", age: 47, email: "marina.galeandro@gmail.com", feePaid: true },
      { firstName: "Massimo", lastName: "Mele", sex: "M", age: 11, email: "marina.galeandro@gmail.com", notes: "Minorenne", feePaid: true, isMinorInsurance: false },
      { firstName: "Mia Frida", lastName: "Mele", sex: "F", age: 16, email: "marina.galeandro@gmail.com", notes: "Minorenne", feePaid: true, isMinorInsurance: false },
      { firstName: "Sofia", lastName: "Colonnello", sex: "F", age: null, email: null, phone: "3336616941", arrivalTime: "14:55", arrivalMode: "train", notes: "Stazione Lamezia. Aggiornamento/duplicato del precedente", feePaid: true, bonifico: true },
      { firstName: "Alessio", lastName: "Vignocchi", sex: "M", age: null, email: null, phone: "3386165551", arrivalTime: "19:00", arrivalMode: "own_car", departureTime: "10:25", notes: "Piazzale Nettuno. Tassa confermata via WhatsApp. Arrivo 08/08", feePaid: true },
      { firstName: "Laiba", lastName: "Ameen", sex: "F", age: 20, email: "laiba.ameen@gmail.com", phone: "3511653961", feePaid: true, bonifico: true },
      { firstName: "Irene", lastName: "Bargellini", sex: "F", age: null, email: null, phone: null, notes: "Nessun altro dato compilato" }
    ]
  },
  {
    number: 9,
    participants: [
      { firstName: "Erica", lastName: "Schmidt", sex: "F", age: 42, email: "erica.schmidt@scuole.provincia.tn.it", phone: "3479542918", feePaid: true, feePaidDate: "2026-03-09", bonifico: true },
      { firstName: "Anna", lastName: "Merli", sex: "F", age: 11, email: "erica.schmidt@scuole.provincia.tn.it", phone: "3479542918", notes: "Figlia di Erica. Minorenne. Assicurazione SI ma non serve (restituire 20€)", feePaid: true, feePaidDate: "2026-03-09", bonifico: true, isMinorInsurance: false },
      { firstName: "Alexander", lastName: "Eberle", sex: "M", age: 43, email: "alexander.eberle@hotmail.com", phone: "3286368676", feePaid: true, feePaidDate: "2026-04-07" },
      { firstName: "Giulio", lastName: "Eberle", sex: "M", age: 11, email: "alexander.eberle@hotmail.com", phone: "3286368676", notes: "Minorenne", feePaid: true, feePaidDate: "2026-04-07", isMinorInsurance: false },
      { firstName: "Mattia", lastName: "Mannella", sex: "M", age: 21, email: "mannellamattia60@gmail.com", phone: "3392348311", feePaid: true, feePaidDate: "2026-05-20" },
      { firstName: "Filippo Ettore", lastName: "Aldeghi", sex: "M", age: 33, email: "aldeghifil@gmail.com", phone: "3347456079", feePaid: true, feePaidDate: "2026-05-19" },
      { firstName: "Anna Maria", lastName: "Perrone", sex: "F", age: 59, email: "amperrone67@gmail.com", phone: "3292652360", arrivalTime: "13:40", arrivalMode: "bus", notes: "Autostazione", feePaid: true, feePaidDate: "2026-07-02" },
      { firstName: "Gianmarco", lastName: "Guidetti", sex: "M", age: 19, email: "g.gianmarco2006@gmail.com", phone: "3477433066", feePaid: true },
      { firstName: "Sofia", lastName: "Colonnello", sex: "F", age: null, email: null, phone: null, notes: "Riparte il 19 da Lamezia alle ore 10:01 con il treno" }
    ]
  },
  {
    number: 10,
    participants: [
      { firstName: "Annalisa", lastName: "Anselmo", sex: "F", age: 47, email: "annalisa.anselmo.to@gmail.com", phone: "3483239585", feePaid: true },
      { firstName: "Chiara", lastName: "Douard", sex: "F", age: 9, email: "annalisa.anselmo.to@gmail.com", notes: "Minorenne", feePaid: true, isMinorInsurance: false },
      { firstName: "Alessandra", lastName: "Guzzo", sex: "F", age: null, email: "alexa.doc8@gmail.com", feePaid: true, feePaidDate: "2026-04-01" },
      { firstName: "Figlio di Alessandra Guzzo", lastName: "", sex: "M", age: null, email: "alexa.doc8@gmail.com", feePaid: true, feePaidDate: "2026-04-01" },
      { firstName: "Alice", lastName: "Ferri", sex: "F", age: 23, email: "aliferri03@gmail.com", phone: "3662689214", feePaid: true, feePaidDate: "2026-04-02" },
      { firstName: "Andres", lastName: "Belloni", sex: "M", age: 16, email: "andresbelloni22@gmail.com", phone: "3899979691", arrivalTime: "10:00", arrivalMode: "bus", notes: "Autostazione di Crotone. Minorenne", feePaid: true, feePaidDate: "2026-04-17", isMinorInsurance: false },
      { firstName: "Giorgia", lastName: "De Zuani", sex: "F", age: 19, email: "giorgia.dezuani@studenti.unipd.it", phone: "3517998949", feePaid: true, feePaidDate: "2026-04-23" },
      { firstName: "Irene", lastName: "Comotti", sex: "F", age: 22, email: "comottiirene@gmail.com", phone: "3703075736", feePaid: true, feePaidDate: "2026-04-03" },
      { firstName: "Francesca Beatrice", lastName: "Passoni", sex: "F", age: 19, email: "passofra07@gmail.com", phone: "3512336179", arrivalTime: "18:35", arrivalMode: "train", departureTime: "13:00", notes: "Stazione Lamezia Terme. NB: arrivo indicato 23/07", feePaid: true, feePaidDate: "2026-05-25" },
      { firstName: "Elisa", lastName: "Mauro", sex: "F", age: 21, email: "easveli05@gmail.com", phone: "3451753994", feePaid: true, feePaidDate: "2026-04-08" },
      { firstName: "Elisabetta", lastName: "Fella", sex: "F", age: null, email: null, phone: null, arrivalTime: "10:30", arrivalMode: "plane_lamezia", notes: "Arrivo 30/08 AE Lamezia", feePaid: true, feePaidDate: "2026-06-25", isMinorInsurance: false },
      { firstName: "Anna Maria", lastName: "Perrone", sex: "F", age: 59, email: "amperrone67@gmail.com", phone: "3292652360", feePaid: true, feePaidDate: "2026-07-02" },
      { firstName: "Mari", lastName: "Kravchenko", sex: "M", age: 17, email: "sv22ks@gmail.com", phone: "3791815588", notes: "Minorenne. Tassa in contanti. Accompagnato dai genitori", feePaid: true, bonifico: true, isMinorInsurance: false },
      { firstName: "Alessia", lastName: "Conte", sex: "F", age: null, email: null, phone: null, notes: "Nessun altro dato compilato" },
      { firstName: "Elena", lastName: "Pischedda", sex: "F", age: 20, email: "elena.g.pischedda@gmail.com", phone: "3808065387", feePaid: true, feePaidDate: "2026-07-11" }
    ]
  },
  {
    number: 11,
    participants: [
      { firstName: "Laura Maria", lastName: "Truchetto", sex: "F", age: 21, email: "laura.truchetto.5@gmail.com", phone: "3398272622", feePaid: true, feePaidDate: "2026-03-24" },
      { firstName: "Fella", lastName: "Elisabetta", sex: "F", age: 17, email: "bellaeli2805@gmail.com", phone: "3518814812", arrivalTime: "10:30", arrivalMode: "plane_lamezia", notes: "Arrivo 30/08 AE Lamezia Terme. Minorenne", feePaid: true, isMinorInsurance: false },
      { firstName: "Valentina", lastName: "Bassi", sex: "F", age: 22, email: "v.bassi.mail@gmail.com", feePaid: true }
    ]
  },
  {
    number: 12,
    participants: []
  }
];