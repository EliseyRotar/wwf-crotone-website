import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import OperatoriManager from "@/components/admin/OperatoriManager";

export const dynamic = "force-dynamic";

export default async function OperatoriPage() {
  await requireSuperadmin();

  const [operatori, turni] = await Promise.all([
    prisma.operatore.findMany({
      where: { deletedAt: null },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, sex: true, role: true, email: true, phone: true, assignedTurns: true, notes: true }
    }),
    prisma.turno.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true } })
  ]);

  return (
    <OperatoriManager
      operatori={operatori.map((o) => ({
        id: o.id,
        firstName: o.firstName,
        lastName: o.lastName,
        sex: o.sex,
        role: o.role,
        email: o.email,
        phone: o.phone,
        assignedTurns: o.assignedTurns,
        notes: o.notes
      }))}
      turni={turni.map((t) => ({ id: t.id, number: t.number }))}
    />
  );
}