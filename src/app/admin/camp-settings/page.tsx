import { requireSuperadmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import CampSettingsEditor from "@/components/admin/CampSettingsEditor";

export const dynamic = "force-dynamic";

export default async function CampSettingsPage() {
  await requireSuperadmin();
  const settings = await prisma.campSettings.findFirst({ orderBy: { createdAt: "desc" } });
  return <CampSettingsEditor settings={settings ? {
    year: settings.year,
    startDate: settings.startDate.toISOString().slice(0, 10),
    endDate: settings.endDate.toISOString().slice(0, 10),
    numTurns: settings.numTurns,
    turnDurationDays: settings.turnDurationDays,
    costNonMember: settings.costNonMember,
    costMember: settings.costMember,
    minorInsurance: settings.minorInsurance,
    registrationFee: settings.registrationFee,
    iban: settings.iban,
    isActive: settings.isActive
  } : null} />;
}