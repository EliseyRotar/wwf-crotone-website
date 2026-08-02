const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function isMinor(age) {
  return age !== null && age !== undefined && age !== "" && age < 18;
}
function cleanPhone(p) { return p ? p.replace(/[^\d+]/g, "") : ""; }
function splitName(full) {
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? { first: parts[0], last: "" } : { first: parts[0], last: parts.slice(1).join(" ") };
}
function mapDiet(alg) {
  if (!alg) return { dietaryNeeds: null, allergies: null };
  const l = alg.toLowerCase();
  if (l.includes("vegetarian")) return { dietaryNeeds: "vegetarian", allergies: null };
  if (l.includes("vegan")) return { dietaryNeeds: "vegan", allergies: null };
  if (l.includes("celiac")) return { dietaryNeeds: "celiac", allergies: null };
  return { dietaryNeeds: null, allergies: alg };
}
function mapPayment(fee) {
  if (!fee) return { feePaid: false, balancePaid: false, status: "pending" };
  const t = fee.toLowerCase().trim();
  if (t.includes("pagata") || t === "si" || t.startsWith("si ") || t.includes("contanti") || t.includes("paga 150"))
    return { feePaid: true, balancePaid: true, status: "paid" };
  if (t.includes("si mex") || t.includes("si (su whatsapp"))
    return { feePaid: true, balancePaid: false, status: "confirmed" };
  if (t.includes("rimane"))
    return { feePaid: true, balancePaid: false, status: "confirmed" };
  return { feePaid: false, balancePaid: false, status: "pending" };
}
function mapArrival(ap) {
  if (!ap) return null;
  const l = ap.toLowerCase();
  if (l.includes("crotone") && (l.includes("ae") || l.includes("aero"))) return "plane_crotone";
  if (l.includes("lamezia") && (l.includes("ae") || l.includes("aero"))) return "plane_lamezia";
  if (l.includes("stazione")) return "train";
  if (l.includes("autostazione") || l.includes("piazzale")) return "bus";
  if (l.includes("autonomamente")) return "own_car";
  return null;
}

const V = [
  // C1
  { t:1, n:"Elisey Rotar", s:"M", a:18, fee:"Pagata il 09/03", paid:"Si", email:"oksanar2006@gmail.com", phone:"3519065041", ap:"AE di Crotone", at:"10:10", ge:"oksanar2006@gmail.com", tess:"SI" },
  { t:1, n:"Mohraeil Medhat", s:"M", a:18, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3483479505", ap:"AE di Crotone", at:"18:05", dp:"AE di Lamezia", dt:"18:25", tess:"SI" },
  { t:1, n:"Sofia Defeudis", s:"F", a:17, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3513986426", ap:"AE di Crotone", at:"18:05", dp:"AE di Lamezia", dt:"18:25", tess:"SI" },
  { t:1, n:"Alice Ficari", s:"F", a:24, fee:"Pagata il 18/06", paid:"Si", email:"alice14febbraio@gmail.com", phone:"3277895287", ap:"Piazzale Nettuno Crotone", at:"18:25", dp:"piazzale Nettuno", dt:"18:25", alg:"vegetariana", tess:"SI" },
  { t:1, n:"Sofia ElFadly", s:"F", a:17, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3756653787", ap:"AE di Crotone", at:"18:05", dp:"AE di Lamezia", dt:"18:25", tess:"SI" },
  { t:1, n:"Sabrina Cekaj", s:"F", a:18, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3711163487", ap:"AE di Crotone", at:"18:05", dp:"AE di Lamezia", dt:"18:25", tess:"SI" },
  { t:1, n:"Miriana", s:"F", a:16, fee:"No", paid:"No (paga 150 euro ass min)", phone:"3883838957", ap:"Arriva autonomamente", at:"18:00" },
  { t:1, n:"Isabella Russo", s:"F", a:16, fee:"No", paid:"No (paga 150 euro ass min)", phone:"3514308494", ap:"Arriva autonomamente", at:"18:00", alg:"Acari della polvere" },
  // C2
  { t:2, n:"Elisey Rotar", s:"M", a:18, fee:"Pagata il 09/03", paid:"Si", email:"oksanar2006@gmail.com", phone:"3519065041", ap:"AE di Crotone", at:"10:10", ge:"oksanar2006@gmail.com", tess:"SI" },
  { t:2, n:"Mohraeil Medhat", s:"M", a:18, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3483479505", dp:"AE di Crotone", dt:"18:25", tess:"SI" },
  { t:2, n:"Sofia Defeudis", s:"F", a:17, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3513986426", dp:"AE di Crotone", dt:"18:25", tess:"SI" },
  { t:2, n:"Sabrina Cekaj", s:"F", a:18, fee:"Pagata il 05/05", paid:"Si", email:"volontariato@associazionebir.it", phone:"3711163487", dp:"AE di Crotone", dt:"18:25", tess:"SI" },
  { t:2, n:"Miriana", s:"F", a:16, fee:"No", paid:"No (paga 150 euro ass min)", phone:"3883838957" },
  { t:2, n:"Isabella Russo", s:"F", a:16, fee:"No", paid:"No (paga 150 euro ass min)", phone:"3514308494", alg:"Acari della polvere" },
  // C3
  { t:3, n:"Anna Lote Kirse", s:"F", a:14, fee:"Pagata il 04/04", paid:"Si", email:"anna@sit.lv", phone:"37125429146" },
  { t:3, n:"Elena Sandra Pavulencko", s:"F", a:16, fee:"Pagata il 04/04", paid:"Si", email:"ellkkwyy@gmail.com", phone:"37125595159" },
  { t:3, n:"Sofya Naumenko", s:"F", a:14, fee:"Pagata il 04/04", paid:"Si", email:"naumenko.julia@gmail.com", phone:"37126302913" },
  { t:3, n:"Anita Colombo", s:"F", a:17, fee:"Pagata il 20/06", paid:"si", email:"barbarafossa@yahoo.it", phone:"3511535061", ap:"AE di Crotone", at:"18:05" },
  { t:3, n:"Elisey Rotar", s:"M", a:18, fee:"Rimane altre due settimane", paid:"Si 100", phone:"3313444410" },
  // C4
  { t:4, n:"Eliott Le Pallec", s:"M", a:24, phone:"0491647180", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Antoine Van Ro", s:"M", a:23, phone:"0476718879", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Alexis Debecker", s:"M", a:24, phone:"0496242424", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Olivia De Sousa Queiros", s:"F", a:22, phone:"0492208411", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Elise Spinewine", s:"F", a:18, phone:"0494948910", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Diego Taminiau", s:"M", a:17, phone:"0487298643", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Esteban Garcia", s:"M", a:17, phone:"0477298314", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Gabriel Lefevre", s:"M", a:17, phone:"0474100303", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Antoine Taminiau", s:"M", a:17, phone:"0455106356", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Maxime Noclain", s:"M", a:17, phone:"0478062179", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Thibaut Charton", s:"M", a:17, phone:"0484578245", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Arthur Leonard", s:"M", a:16, phone:"0455124949", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Martin Demaret", s:"M", a:16, phone:"0455124209", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Thomas Delsemme", s:"M", a:16, phone:"0476865204", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Alys Hasse", s:"F", a:16, phone:"0469106740", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Charles Cardyn", s:"M", a:16, phone:"0455105894", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Laura Taburiaux", s:"F", a:16, phone:"0492451512", ap:"AE di Crotone", at:"11:30" },
  { t:4, n:"Elisey Rotar", s:"M", a:18, fee:"SI", paid:"SI", phone:"3313444410" },
  // C5
  { t:5, n:"Mattia Grammatico", s:"M", a:15, fee:"Pagata il 07/04", paid:"si", email:"grammatico.matty@gmail.com", phone:"3807587700", ap:"STAZIONE LAMEZIA", at:"15:16" },
  { t:5, n:"Lo Re Riccardo", s:"M", a:16, fee:"Pagata il 08/04", paid:"No", email:"riclore10@gmail.com", phone:"3516429312", ap:"STAZIONE LAMEZIA", at:"15:16", notes:"madre 3389023175" },
  { t:5, n:"Simone Colombo", s:"M", a:15, fee:"Pagata il 18/04", paid:"13/07/2026", email:"quadrani@libero.it", phone:"3280211094", ap:"Stazione Lamezia", at:"17:30" },
  { t:5, n:"Diallo Boubacar", s:"M", a:21, fee:"Pagata il 22/06", paid:"SI", email:"margherita.ramacciotti@progettofragile.eu", phone:"3514157078", ap:"STAZIONE LAMEZIA", at:"17:43", dp:"STAZIONE LAMEZIA", dt:"10:20" },
  { t:5, n:"Anna Preite", s:"F", a:18, fee:"No", paid:"No", email:"angyromano@libero.it", phone:"3274425972", ap:"STAZIONE LAMEZIA", at:"15:30" },
  { t:5, n:"Alice Parente", s:"F", a:16, fee:"Si", paid:"No", email:"rmoschetta@libero.it", phone:"3388373244", ap:"STAZIONE LAMEZIA", at:"15:30" },
  { t:5, n:"Elisey Rotar", s:"M", a:18, fee:"SI", paid:"SI", phone:"3313444410" },
  { t:5, n:"Miriana", s:"F", a:16, fee:"No", paid:"No (paga 150 euro ass min)", phone:"3883838957", ap:"arriva autonomamente" },
  // C6
  { t:6, n:"Davide Ventura", s:"M", a:26, fee:"Si il 27/05", paid:"No", email:"ventu.dvd@gmail.com", phone:"3274398295" },
  { t:6, n:"Andrea La Greca", s:"M", a:15, fee:"Si mex whatsapp", paid:"No", phone:"3519393294" },
  { t:6, n:"Elisey Rotar", s:"M", a:18, phone:"3313444410" },
  { t:6, n:"Miriana", s:"F", a:16, fee:"No", paid:"No (paga 150 euro ass min)", phone:"3883838957" },
  // C7
  { t:7, n:"Giulia Bellanti", s:"F", a:31, fee:"Si", paid:"No", email:"giuliabellanti@icloud.com", phone:"+393402703439" },
  { t:7, n:"Eleonora Falletto", s:"F", a:22, fee:"SI", paid:"No", email:"eleonora.falletto@gmail.com", phone:"3273019281" },
  { t:7, n:"Chiara De Nicola", s:"F", a:28, fee:"SI", paid:"No", email:"denicolachiara5@gmail.com", phone:"3385237472" },
  { t:7, n:"Asia Evangelista", s:"F", a:18, fee:"SI", paid:"No", email:"luca09372@gmail.com", phone:"3515037337" },
  { t:7, n:"Michelle Tagliaferri", s:"F", a:24, fee:"SI", paid:"SI", email:"mjchelletagliaferri@gmail.com", phone:"3423832351" },
  { t:7, n:"Valentina Ragone", s:"F", a:null, fee:"Si", paid:"No", phone:"3451838804" },
  { t:7, n:"Alessandro Zoltan Messina", s:"M", a:27, fee:"Si", paid:"no", email:"alessandro.messina99@gmail.com", phone:"3667068237", ap:"stazione lamezia", at:"13:16", dp:"stazione lamezia", dt:"10:15" },
  { t:7, n:"Sofia Colonnello", s:"F", a:null, fee:"Si", paid:"Si", phone:"3336616941" },
  { t:7, n:"Palmieri Elena", s:"F", a:30, fee:"SI", paid:"No", email:"elena.palmieri17@gmail.com", phone:"3478182888" },
  { t:7, n:"Elisey Rotar", s:"M", a:18, fee:"SI", paid:"SI", phone:"3313444410", dp:"Aeroporto crotone", dt:"16:15" },
  // C8
  { t:8, n:"Giorgia Rizzo", s:"F", a:25, fee:"Pagata il 31/03", email:"giorgiar2001@gmail.com", phone:"3423649940", ap:"Stazione di Crotone", at:"11:20" },
  { t:8, n:"Filippo Ettore Aldeghi", s:"M", a:null, fee:"Pagata il 19/05", phone:"3347456079" },
  { t:8, n:"Valentina Ragone", s:"F", a:null, fee:"Si", paid:"No", phone:"3451838804" },
  { t:8, n:"Sofia Colonnello", s:"F", a:null, fee:"Si", paid:"Si", phone:"3336616941" },
  { t:8, n:"Eric Stefan Miele", s:"M", a:31, fee:"Si", paid:"No", email:"ericstefan.miele@protonmail.com", phone:"34008264032" },
  { t:8, n:"Silvia Quintana", s:"F", a:44, fee:"SI", paid:"NO", email:"qui.sil@gmail.com", phone:"3289449035" },
  { t:8, n:"Pitar Kamarashev", s:"M", a:null, fee:"Si (su whatsapp)" },
  { t:8, n:"Erica Colapinto", s:"F", a:null, fee:"Si (su whatsapp)" },
  // C9
  { t:9, n:"Erica Schmidt", s:"F", a:42, fee:"Pagata il 09/03", paid:"SI", email:"erica.schmidt@scuole.provincia.tn.it", phone:"3479542918" },
  { t:9, n:"Anna Merli", s:"F", a:11, fee:"Pagata il 09/03", paid:"SI", email:"erica.schmidt@scuole.provincia.tn.it", phone:"3479542918", ge:"erica.schmidt@scuole.provincia.tn.it", notes:"Figlia di Erica Schmidt" },
  { t:9, n:"Alexander Eberle", s:"M", a:43, fee:"Pagata il 07/04", paid:"No", email:"alexander.eberle@hotmail.com", phone:"3286368676" },
  { t:9, n:"Giulio Eberle", s:"M", a:11, fee:"Pagata il 07/04", paid:"No", email:"alexander.eberle@hotmail.com", phone:"3286368676", ge:"alexander.eberle@hotmail.com", notes:"Figlio di Alexander Eberle" },
  { t:9, n:"Mattia Mannella", s:"M", a:21, fee:"Pagata il 20/05", paid:"No", email:"mannellamattia60@gmail.com", phone:"3392348311" },
  { t:9, n:"Filippo Ettero Aldeghi", s:"M", a:33, fee:"Pagata il 19/05", paid:"No", email:"aldeghifil@gmail.com", phone:"3347456079" },
  { t:9, n:"Anna Maria Perrone", s:"F", a:59, fee:"PAGATA IL 02/07", paid:"no", email:"amperrone67@gmail.com", phone:"3292652360" },
  // C10
  { t:10, n:"Annalisa Anselmo", s:"F", a:47, fee:"Si", paid:"No", email:"annalisa.anselmo.to@gmail.com", phone:"3483239585" },
  { t:10, n:"Chiara Douard", s:"F", a:9, fee:"Si", paid:"No", email:"annalisa.anselmo.to@gmail.com", ge:"annalisa.anselmo.to@gmail.com", notes:"Figlia di Annalisa Anselmo" },
  { t:10, n:"Alessandra Guzzo", s:"F", a:null, fee:"Si pagata 1/04", email:"alexa.doc8@gmail.com" },
  { t:10, n:"Figlio Alessandra Guzzo", s:"M", a:null, fee:"Si pagata 1/04", email:"alexa.doc8@gmail.com", ge:"alexa.doc8@gmail.com", notes:"Figlio di Alessandra Guzzo" },
  { t:10, n:"Alice Ferri", s:"F", a:23, fee:"Si pagata 02/04", paid:"No", email:"aliferri03@gmail.com", phone:"3662689214" },
  { t:10, n:"Andres Belloni", s:"M", a:16, fee:"Si pagata 17/04/2026", paid:"No", email:"andresbelloni22@gmail.com", phone:"3899979691", ap:"Autostazione di Crotone", at:"10:00" },
  { t:10, n:"Giorgia De Zuani", s:"F", a:19, fee:"Si pagata 23/04/2026", paid:"No", email:"giorgia.dezuani@studenti.unipd.it", phone:"3517998949" },
  { t:10, n:"Irene Comotti", s:"F", a:22, fee:"Si pagata 03/04/2026", paid:"No", email:"comottiirene@gmail.com", phone:"3703075736" },
  { t:10, n:"Francesca Beatrice Passoni", s:"F", a:19, fee:"Si pagata 25/05/2026", paid:"No", email:"passofra07@gmail.com", phone:"3512336179" },
  { t:10, n:"Elisa Mauro", s:"F", a:21, fee:"Si pagata 08/04", paid:"No", email:"easveli05@gmail.com", phone:"3451753994" },
  { t:10, n:"Elisabetta Fella", s:"F", a:null, fee:"pagata 25/06/2026", ap:"AE lamezia", at:"10:30" },
  { t:10, n:"Anna Maria Perrone", s:"F", a:59, fee:"PAGATA IL 02/07", paid:"no", email:"amperrone67@gmail.com", phone:"3292652360" },
  { t:10, n:"Mari Kravchrnko", s:"M", a:17, fee:"Si contanti", paid:"si", email:"Sv22ks@gmail.com", phone:"3791815588", notes:"Lo accompagnano i genitori" },
  { t:10, n:"Elena Pischedda", s:"F", a:20, fee:"SI 11/07/2026", paid:"no", email:"elena.g.pischedda@gmail.com", phone:"3808065387" },
  // C11
  { t:11, n:"Laura Maria Truchetto", s:"F", a:21, fee:"Si pagata 24/03", paid:"No", email:"laura.truchetto.5@gmail.com", phone:"3398272622" },
  { t:11, n:"Elisabetta Fella", s:"F", a:17, fee:"No", paid:"No", email:"bellaeli2805@gmail.com", phone:"3518814812", ap:"AE Lamezia Terme", at:"10:30" },
];

const OPERATORS = [
  { firstName:"Luca", lastName:"", sex:"M", role:"operatore" },
  { firstName:"Lorenzo", lastName:"2", sex:"M", role:"operatore", notes:"Lorenzo 2" },
  { firstName:"Lorenzo", lastName:"1", sex:"M", role:"operatore", notes:"Lorenzo 1 — arrivo 15/07 al campo 4" },
  { firstName:"Luigi", lastName:"", sex:"M", role:"operatore" },
  { firstName:"Carlo", lastName:"", sex:"M", role:"operatore", notes:"AR 01/07" },
  { firstName:"Elena", lastName:"", sex:"F", role:"operatore" },
  { firstName:"Giulia", lastName:"", sex:"F", role:"operatore" },
  { firstName:"Nadia", lastName:"", sex:"F", role:"chef", notes:"Cucina" },
  { firstName:"Nicola", lastName:"", sex:"M", role:"operatore" },
  { firstName:"Elisey", lastName:"Rotar", sex:"M", role:"tecnico", notes:"Tecnico" }
];

const TURN_ASSIGNS = {
  "Luca":[1,2,3,4,5,6,7,8,9,10,11,12],
  "Lorenzo 2":[1,2,3,4,5,6,7,8,9,10,11,12],
  "Lorenzo 1":[4,5,6,7,8,9,10,11,12],
  "Luigi":[1,2,3,4,5,6,7,8,9,10,11],
  "Carlo":[2,3,4,5,6,7,8,9,10,11,12],
  "Elena":[1,2,3,4,5,6,7,8,9,10,11],
  "Giulia":[1,2,3,4,5,6,7,8,9,10,11,12],
  "Nadia":[3,5,6,7,8,9,10,11,12],
  "Nicola":[6,7,8,9,10,11],
  "Elisey Rotar":[1,2,3,4,5,6,7]
};

async function main() {
  console.log("Deleting all existing data...");
  await prisma.receipt.deleteMany({});
  await prisma.iscrizione.deleteMany({});
  await prisma.operatore.deleteMany({});

  console.log("Importing " + V.length + " volunteers...");
  let count = 0;
  for (const v of V) {
    if (!v.n || !v.n.trim()) continue;
    const { first, last } = splitName(v.n);
    const minor = isMinor(v.a);
    const diet = mapDiet(v.alg);
    const payment = mapPayment(v.fee);

    let notes = "[import]";
    if (v.notes) notes += " " + v.notes;
    if (v.fee) notes += " | Tassa: " + v.fee;
    if (v.paid) notes += " | Bonifico: " + v.paid;
    if (v.ge) notes += " | Email genitore: " + v.ge;
    if (v.tess) notes += " | Tessera: " + v.tess;

    const turno = await prisma.turno.findFirst({ where: { number: v.t } });
    if (!turno) { console.warn("Turno " + v.t + " not found"); continue; }

    await prisma.iscrizione.create({
      data: {
        firstName: first,
        lastName: last,
        birthDate: null,      // NO birthDate — we only have age
        age: v.a || null,     // store age directly
        email: (v.email || "").toLowerCase(),
        phone: cleanPhone(v.phone),
        isMinor: minor,
        guardianName: minor ? "Importato da Excel" : null,
        guardianEmail: v.ge || null,
        guardianConsent: minor,
        turnoId: turno.id,
        allergies: diet.allergies,
        dietaryNeeds: diet.dietaryNeeds,
        arrivalMode: mapArrival(v.ap),
        arrivalTime: v.at || null,
        departureTime: v.dt || null,
        feePaid: payment.feePaid,
        feePaidDate: payment.feePaid ? new Date(2026, 2, 1) : null,
        balancePaid: payment.balancePaid,
        balancePaidDate: payment.balancePaid ? new Date(2026, 2, 1) : null,
        notes: notes,
        status: payment.status,
        privacyConsent: true,
        marketingConsent: false,
        imageDataConsent: true
      }
    });
    count++;
  }
  console.log("Imported " + count + " volunteers.");

  // Operators
  const turni = await prisma.turno.findMany({ select: { id: true, number: true } });
  const turnById = new Map(turni.map(t => [t.number, t.id]));
  for (const op of OPERATORS) {
    const key = op.lastName ? op.firstName + " " + op.lastName : op.firstName;
    const turnNumbers = TURN_ASSIGNS[key] || [];
    const assignedTurnIds = turnNumbers.map(n => turnById.get(n)).filter(Boolean).join(",");
    await prisma.operatore.create({
      data: { firstName: op.firstName, lastName: op.lastName || "", sex: op.sex || null, role: op.role, notes: op.notes || null, assignedTurns: assignedTurnIds || null }
    });
  }

  // VERIFY
  console.log("\n=== VERIFY ===");
  const checks = [
    { n:"Elisey Rotar", t:1, expectAge:18, expectMinor:false },
    { n:"Sofia Defeudis", t:1, expectAge:17, expectMinor:true },
    { n:"Chiara Douard", t:10, expectAge:9, expectMinor:true },
    { n:"Anna Merli", t:9, expectAge:11, expectMinor:true },
    { n:"Erica Schmidt", t:9, expectAge:42, expectMinor:false },
    { n:"Valentina Ragone", t:7, expectAge:null, expectMinor:false },
  ];
  for (const c of checks) {
    const [fn, ...lnP] = c.n.split(" ");
    const r = await prisma.iscrizione.findFirst({ where: { firstName: fn, lastName: lnP.join(" "), turno: { number: c.t } } });
    const ok = r && r.age === c.expectAge && r.isMinor === c.expectMinor && r.birthDate === null;
    console.log(`${ok ? "✓" : "✗"} ${c.n} (T${c.t}): age=${r?.age} birthDate=${r?.birthDate} isMinor=${r?.isMinor} — expected age=${c.expectAge}`);
  }

  const fakeEmails = await prisma.iscrizione.count({ where: { email: { contains: "@import" } } });
  console.log(`\nFake @import emails: ${fakeEmails} (should be 0)`);
  const nullBirth = await prisma.iscrizione.count({ where: { birthDate: null } });
  console.log(`Null birthDates (correct): ${nullBirth}`);
  const withAge = await prisma.iscrizione.count({ where: { NOT: { age: null } } });
  console.log(`With age set: ${withAge}`);

  for (let t = 1; t <= 12; t++) {
    const n = await prisma.iscrizione.count({ where: { turno: { number: t } } });
    if (n > 0) console.log(`  Campo ${t}: ${n}`);
  }

  const total = await prisma.iscrizione.count();
  console.log(`\nTotal: ${total}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });