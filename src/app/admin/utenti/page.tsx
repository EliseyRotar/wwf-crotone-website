import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import UsersManager from "@/components/admin/UsersManager";

export const dynamic = "force-dynamic";

export default async function UtentiPage() {
  const session = await requireSuperadmin();
  const [users, turni] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.turno.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true, endDate: true } })
  ]);

  return (
    <div>
      <h1 className="text-3xl mb-1">Utenti</h1>
      <p className="text-ink-grey text-sm mb-8">
        Crea account manager (con turni assegnati) o superadmin. I manager scadono automaticamente una settimana dopo la fine del loro ultimo turno assegnato.
      </p>
      <UsersManager
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          assignedTurns: u.assignedTurns,
          expiresAt: u.expiresAt ? u.expiresAt.toISOString() : null,
          active: u.active
        }))}
        turni={turni.map((t) => ({ id: t.id, number: t.number, endDate: t.endDate }))}
        currentId={session.id}
      />
    </div>
  );
}