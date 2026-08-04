import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 12 weekly turns, summer 2026 — dates from the official PDF
const TURNI_2026: { number: number; startDate: string; endDate: string }[] = [
  { number: 1, startDate: "2026-06-21", endDate: "2026-06-28" },
  { number: 2, startDate: "2026-06-28", endDate: "2026-07-05" },
  { number: 3, startDate: "2026-07-05", endDate: "2026-07-12" },
  { number: 4, startDate: "2026-07-12", endDate: "2026-07-19" },
  { number: 5, startDate: "2026-07-19", endDate: "2026-07-26" },
  { number: 6, startDate: "2026-07-26", endDate: "2026-08-02" },
  { number: 7, startDate: "2026-08-02", endDate: "2026-08-09" },
  { number: 8, startDate: "2026-08-09", endDate: "2026-08-16" },
  { number: 9, startDate: "2026-08-16", endDate: "2026-08-23" },
  { number: 10, startDate: "2026-08-23", endDate: "2026-08-30" },
  { number: 11, startDate: "2026-08-30", endDate: "2026-09-06" },
  { number: 12, startDate: "2026-09-06", endDate: "2026-09-13" }
];

const GALLERY_SEED: {
  type: string;
  src: string;
  titleIt: string;
  titleEn: string;
  captionIt: string;
  captionEn: string;
  category: string;
  year: number;
}[] = [
  {
    type: "image",
    src: "/images/gallery/Spiaggia_allinterno_dellArea_Marina_Protetta_di_Capo_Rizzuto.png",
    titleIt: "Spiaggia nell'Area Marina Protetta di Capo Rizzuto",
    titleEn: "Beach inside the Capo Rizzuto Marine Protected Area",
    captionIt: "La costa protetta dell'AMP di Capo Rizzuto, lunga 42 km.",
    captionEn: "The protected coastline of the Capo Rizzuto MPA, 42 km long.",
    category: "campo",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/drone_shot_beach_plus_sea.png",
    titleIt: "Monitoraggio con drone",
    titleEn: "Drone monitoring",
    captionIt: "Sorveglianza aerea dei siti di nidificazione della Caretta caretta.",
    captionEn: "Aerial surveillance of Caretta caretta nesting sites.",
    category: "tartarughe",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/ricerca_nidi_con_unita_cinofila.png",
    titleIt: "Ricerca nidi con unità cinofila",
    titleEn: "Nest search with canine unit",
    captionIt: "Unità cinofile specializzate per l'individuazione dei nidi.",
    captionEn: "Specialized canine units to locate nests.",
    category: "tartarughe",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/ricerca_nidi.png",
    titleIt: "Ricerca dei nidi di Caretta caretta",
    titleEn: "Searching for Caretta caretta nests",
    captionIt: "Volontari sulle spiagge all'alba alla ricerca di tracce di emersione.",
    captionEn: "Volunteers on the beaches at dawn searching for emergence tracks.",
    category: "tartarughe",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/tracce_Caretta_caretta.png",
    titleIt: "Tracce di Caretta caretta",
    titleEn: "Caretta caretta tracks",
    captionIt: "Le tracce sulla sabbia vengono rilevate al mattino presto.",
    captionEn: "Tracks in the sand are detected early in the morning.",
    category: "tartarughe",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/schiusa_tartarughe.png",
    titleIt: "Schiusa delle uova di tartaruga",
    titleEn: "Sea turtle hatching",
    captionIt: "Il momento più emozionante: la schiusa dei nidi protetti.",
    captionEn: "The most emotional moment: the hatching of protected nests.",
    category: "schiuse",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/tartaruga_nel_Centro_Recupero_Tartarughe_Marine.png",
    titleIt: "Tartaruga nel CRTM",
    titleEn: "Turtle at the Marine Turtle Recovery Center",
    captionIt: "Un esemplare in cura presso il Centro Recupero Tartarughe Marine di Capo Rizzuto.",
    captionEn: "A specimen in care at the Capo Rizzuto Marine Turtle Recovery Center.",
    category: "tartarughe",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/pulizia_spiaggia.png",
    titleIt: "Pulizia delle spiagge",
    titleEn: "Beach cleanup",
    captionIt: "Attività di pulizia delle spiagge nelle aree protette dell'AMP.",
    captionEn: "Beach cleanup activities in the protected areas of the MPA.",
    category: "cleanup",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/recupero_animali_selvatici.png",
    titleIt: "Recupero di animali selvatici",
    titleEn: "Wildlife rescue",
    captionIt: "Soccorso di animali selvatici in collaborazione con il CRAS di Catanzaro.",
    captionEn: "Wildlife rescue in collaboration with the CRAS of Catanzaro.",
    category: "wildlife",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/photo_base_wwf_crotone.png",
    titleIt: "La base di WWF Crotone — C.E.L.A.",
    titleEn: "The WWF Crotone base — C.E.L.A.",
    captionIt: "Il Centro di Educazione alla Legalità e all'Ambiente, sede del campo.",
    captionEn: "The Center for Education on Legality and the Environment, the camp's base.",
    category: "campo",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/escursione_a_Mesoraca_con_le_conche_e_riserva_protetta.png",
    titleIt: "Escursione alla Riserva di Mesoraca",
    titleEn: "Excursion to the Mesoraca Reserve",
    captionIt: "Escursione guidata nella Riserva Naturale Regionale del Vergari.",
    captionEn: "Guided excursion in the Vergari Regional Nature Reserve.",
    category: "cultura",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/Capocolonna.png",
    titleIt: "Parco Archeologico di Capocolonna",
    titleEn: "Capocolonna Archaeological Park",
    captionIt: "Visita guidata al Parco Archeologico e al Museo di Capocolonna.",
    captionEn: "Guided visit to the Capocolonna Archaeological Park and Museum.",
    category: "cultura",
    year: 2026
  },
  {
    type: "image",
    src: "/images/gallery/photo_citta_Le_Castella.png",
    titleIt: "Castello Aragonese di Le Castella",
    titleEn: "Aragonese Castle of Le Castella",
    captionIt: "Visita guidata al Castello Aragonese di Le Castella (KR).",
    captionEn: "Guided visit to the Aragonese Castle of Le Castella (KR).",
    category: "cultura",
    year: 2026
  }
];

async function main() {
  console.log("Seeding turni...");
  for (const t of TURNI_2026) {
    await prisma.turno.upsert({
      where: { number: t.number },
      update: {
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate)
      },
      create: {
        number: t.number,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        capacity: 20,
        isActive: true
      }
    });
  }
  console.log(`Seeded ${TURNI_2026.length} turni.`);

  console.log("Seeding gallery...");
  await prisma.galleryItem.deleteMany({});
  for (const g of GALLERY_SEED) {
    await prisma.galleryItem.create({ data: g });
  }
  console.log(`Seeded ${GALLERY_SEED.length} gallery items.`);

  console.log("Seeding superadmin user...");
  const adminEmail = "admin@wwfcrotone.it";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash("changeme-now", 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Super Admin",
        passwordHash: hash,
        role: "superadmin",
        assignedTurns: null
      }
    });
    console.log("Created superadmin: admin@wwfcrotone.it / changeme-now (CHANGE IMMEDIATELY via /admin/account)");
  } else {
    console.log("Superadmin already exists, skipping.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });