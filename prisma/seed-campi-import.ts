// One-off import script for CAMPI_2026.xlsx subscription data.
// Run via:  npx tsx prisma/seed-campi-import.ts
//
// Idempotent: re-running updates existing rows by (firstName + lastName + turnoId).
// Existing operatori/turni are not touched.

import { PrismaClient } from "@prisma/client";
import { CAMPI, OPERATORI } from "./seed-campi-2026";

const prisma = new PrismaClient();

const turnoCache = new Map<number, string>();
async function turnoId(number: number): Promise<string> {
  if (!turnoCache.has(number)) {
    const t = await prisma.turno.findUnique({ where: { number } });
    if (!t) throw new Error(`Turno #${number} not found in DB. Run seed first.`);
    turnoCache.set(number, t.id);
  }
  return turnoCache.get(number)!;
}

async function main() {
  console.log("=== Importing CAMPI 2026 data ===\n");

  // ---- Operator import ----
  console.log("Importing operatori...");

  // Group operator entries by name to merge turni + notes
  const operatorByName = new Map<string, { turni: Set<number>; notes: Set<string> }>();
  for (const op of OPERATORI) {
    if (!operatorByName.has(op.name)) {
      operatorByName.set(op.name, { turni: new Set(), notes: new Set() });
    }
    const e = operatorByName.get(op.name)!;
    op.turni.forEach(t => e.turni.add(t));
    if (op.note) e.notes.add(op.note);
  }

  for (const [name, e] of operatorByName) {
    const sortedTurni = [...e.turni].sort((a, b) => a - b);
    const ids: string[] = [];
    for (const t of sortedTurni) ids.push(await turnoId(t));

    // Promote "Luca" to coordinatore; others "operatore"
    const role = name === "Luca" ? "coordinatore" : "operatore";

    // Compose notes
    const notesArr: string[] = [];
    notesArr.push(`turni: ${sortedTurni.join(",")}`);
    for (const n of e.notes) {
      if (n !== "coordinatore") notesArr.push(n);
    }

    // Find existing by firstName (operatori don't have unique constraint; firstName is just a string)
    const existing = await prisma.operatore.findFirst({
      where: { firstName: name, deletedAt: null }
    });

    if (existing) {
      await prisma.operatore.update({
        where: { id: existing.id },
        data: {
          role,
          assignedTurns: ids.join(","),
          notes: notesArr.join(" | ")
        }
      });
    } else {
      await prisma.operatore.create({
        data: {
          firstName: name,
          lastName: "",
          role,
          assignedTurns: ids.join(","),
          notes: notesArr.join(" | ")
        }
      });
    }
    console.log(`  ${name} (${role}): turni ${sortedTurni.join(",")}`);
  }

  // ---- Participant import ----
  console.log("\nImporting iscrizioni...");
  let totalNew = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;

  for (const campo of CAMPI) {
    console.log(`\n--- Campo ${campo.number} (${campo.participants.length} entries) ---`);
    const tId = await turnoId(campo.number);

    for (const p of campo.participants) {
      if (!p.firstName && !p.lastName && !p.phone && !p.email) {
        console.log(`  SKIP (empty)`);
        continue;
      }

      const isMinor = p.age !== null && p.age < 18;
      const feePaid = Boolean(p.feePaid || p.bonifico);
      const balancePaid = Boolean(p.bonifico);
      const status = feePaid ? "confirmed" : "pending";

      const data = {
        firstName: p.firstName || "(sconosciuto)",
        lastName: p.lastName || "",
        age: p.age,
        isMinor,
        email: p.email || "",
        phone: p.phone || "",
        arrivalMode: p.arrivalMode ?? null,
        arrivalTime: p.arrivalTime ?? null,
        departureTime: p.departureTime ?? null,
        dietaryNeeds: p.dietaryNeeds ?? null,
        allergies: p.allergies ?? null,
        notes: p.notes ?? null,
        status,
        feePaid,
        feePaidDate: p.feePaidDate ? new Date(p.feePaidDate) : null,
        balancePaid,
        balancePaidDate: balancePaid ? (p.feePaidDate ? new Date(p.feePaidDate) : new Date()) : null,
        privacyConsent: true,
        marketingConsent: false,
        imageDataConsent: false
      };

      const existing = await prisma.iscrizione.findFirst({
        where: {
          turnoId: tId,
          firstName: data.firstName,
          lastName: data.lastName
        }
      });

      if (existing) {
        await prisma.iscrizione.update({
          where: { id: existing.id },
          data: { ...data, updatedAt: new Date() }
        });
        totalUpdated++;
        console.log(`  UPDATE: ${data.firstName} ${data.lastName} (${status})`);
      } else {
        await prisma.iscrizione.create({
          data: { turnoId: tId, ...data }
        });
        totalNew++;
        console.log(`  CREATE: ${data.firstName} ${data.lastName} (${status})`);
      }
      totalProcessed++;
    }
  }

  // ---- Recompute Turno.bookedCount ----
  console.log("\nRecomputing Turno.bookedCount...");
  for (const campo of CAMPI) {
    const tId = await turnoId(campo.number);
    const count = await prisma.iscrizione.count({
      where: { turnoId: tId, status: { notIn: ["cancelled"] } }
    });
    await prisma.turno.update({
      where: { id: tId },
      data: { bookedCount: count }
    });
    console.log(`  Campo ${campo.number}: bookedCount = ${count}`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Processed: ${totalProcessed} | New: ${totalNew} | Updated: ${totalUpdated}`);
  console.log(`Operatori: ${operatorByName.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });