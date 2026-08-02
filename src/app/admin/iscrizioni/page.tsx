import Link from "next/link";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import IscrizioneRowControls from "@/components/admin/IscrizioneRowControls";
import ManualAddVolunteer from "@/components/admin/ManualAddVolunteer";
import EditVolunteer from "@/components/admin/EditVolunteer";
import ViewVolunteer from "@/components/admin/ViewVolunteer";
import DeleteVolunteer from "@/components/admin/DeleteVolunteer";
import BulkEmailButton from "@/components/admin/BulkEmailButton";
import IscrizioniBulkBar from "@/components/admin/IscrizioniBulkBar";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { getCampStart, calcAge } from "@/lib/turns";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function IscrizioniPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; turno?: string; from?: string; to?: string; page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const store = await cookies();
  const { startDate: campStart } = await getCampStart();
  const locale = store.get("admin-lang")?.value === "en" ? "en" : "it";
  const t = await getTranslations({ locale, namespace: "Admin.iscrizioni" });

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: { status?: string; turnoId?: string; createdAt?: { gte?: Date; lte?: Date } } = {};
  if (sp.status && ["pending", "confirmed", "paid", "cancelled", "waitlist"].includes(sp.status)) {
    where.status = sp.status;
  }
  if (sp.turno) where.turnoId = sp.turno;

  // F22: date range filter on createdAt
  if (sp.from || sp.to) {
    where.createdAt = {};
    if (sp.from) {
      const d = new Date(sp.from);
      if (!isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (sp.to) {
      const d = new Date(sp.to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
  }

  const managerTurnFilter = session.role !== "superadmin"
    ? { turnoId: { in: (session.assignedTurns ?? "").split(",").filter(Boolean) } }
    : {};

  const combinedWhere = { ...where, ...managerTurnFilter };

  const total = await prisma.iscrizione.count({ where: combinedWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [iscrizioni, turni] = await Promise.all([
    prisma.iscrizione.findMany({
      where: combinedWhere,
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        birthDate: true, age: true, isMinor: true, status: true, feePaid: true,
        balancePaid: true, feePaidDate: true, balancePaidDate: true,
        guardianName: true, guardianEmail: true, guardianPhone: true,
        guardianConsent: true, allergies: true, medications: true,
        swimmingAbility: true, tetanusStatus: true, fitnessSelf: true,
        dietaryNeeds: true, dietaryNotes: true, tshirtSize: true,
        arrivalMode: true, arrivalTime: true, departureTime: true,
        notes: true, imageDataConsent: true, marketingConsent: true, privacyConsent: true,
        createdAt: true,
        turno: { select: { number: true, startDate: true, endDate: true } },
        iscrizioneTurni: {
          select: { isPrimary: true, turno: { select: { number: true } } }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE
    }),
    prisma.turno.findMany({
      orderBy: { number: "asc" },
      select: { id: true, number: true, startDate: true, endDate: true }
    })
  ]);

  const statusLabels: Record<string, string> = {
    pending: t("pending"), confirmed: t("confirmed"), paid: t("paid"),
    waitlist: t("waitlist"), cancelled: t("cancelled")
  };

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.turno) params.set("campo", sp.turno);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/iscrizioni?${qs}` : "/admin/iscrizioni";
  };

  const buildCsvHref = () => {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.turno) params.set("campo", sp.turno);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    const qs = params.toString();
    return qs ? `/api/admin/iscrizioni/csv?${qs}` : "/api/admin/iscrizioni/csv";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl">{t("title")}</h1>
        <div className="flex gap-2 flex-wrap">
          <ManualAddVolunteer turni={turni.map((t_) => ({ id: t_.id, number: t_.number, start: t_.startDate, end: t_.endDate }))} />
          <a href={buildCsvHref()} className="btn btn-outline">
            <Download size={18} /> {t("exportCsv")}
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/iscrizioni" className={`tag ${!sp.status && !sp.turno && !sp.from && !sp.to ? "tag-green" : "tag-grey"}`}>{t("all")}</Link>
        {["pending", "confirmed", "paid", "waitlist", "cancelled"].map((s) => (
          <Link key={s} href={`/admin/iscrizioni?status=${s}`} className={`tag ${sp.status === s ? "tag-green" : "tag-grey"}`}>
            {statusLabels[s]}
          </Link>
        ))}
        <span className="mx-2 text-ink-grey-light">|</span>
        <span className="tag tag-grey inline-flex items-center gap-1"><Filter size={12} /> {t("filterTurn")}:</span>
        {turni.map((t_) => (
          <Link key={t_.id} href={`/admin/iscrizioni?turno=${t_.id}`} className={`tag ${sp.turno === t_.id ? "tag-green" : "tag-grey"}`}>
            C{t_.number}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-2 mb-6 p-3 bg-sand rounded-lg" method="get">
        {(sp.status || sp.turno) && (
          <input type="hidden" name={sp.status ? "status" : "turno"} value={sp.status ?? sp.turno ?? ""} />
        )}
        <div>
          <label className="block text-xs uppercase tracking-cta text-ink-grey mb-1">{t("dateFrom")}</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="px-2 py-1 border border-ink-grey-light rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-cta text-ink-grey mb-1">{t("dateTo")}</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="px-2 py-1 border border-ink-grey-light rounded text-sm" />
        </div>
        <button type="submit" className="btn btn-green text-sm px-4 py-1.5">{t("applyFilter")}</button>
        {(sp.from || sp.to) && (
          <Link href="/admin/iscrizioni" className="text-xs text-ink-grey hover:text-wwf-red underline">{t("clearFilter")}</Link>
        )}
      </form>

      {sp.turno && (
        <div className="mb-4">
          <BulkEmailButton turnoId={sp.turno} />
        </div>
      )}

      {total > 0 && (
        <p className="text-sm text-ink-grey mb-3">
          {t("showing")} {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} {t("of")} {total} {t("results")}
        </p>
      )}

      {iscrizioni.length === 0 ? (
        <p className="text-ink-grey">{t("noResults")}</p>
      ) : (
        <>
          <IscrizioniBulkBar ids={iscrizioni.map((i) => i.id)} />
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="border-b border-ink-grey-light text-left">
                  <th scope="col" className="p-3 w-8"></th>
                  <th scope="col" className="p-3 uppercase tracking-cta text-ink-grey">{t("name")}</th>
                  <th scope="col" className="p-3 uppercase tracking-cta text-ink-grey">{t("email")}</th>
                  <th scope="col" className="p-3 uppercase tracking-cta text-ink-grey">{t("phone")}</th>
                  <th scope="col" className="p-3 uppercase tracking-cta text-ink-grey">{t("campo")}</th>
                  <th scope="col" className="p-3 uppercase tracking-cta text-ink-grey">{t("age")}</th>
                  <th scope="col" className="p-3 uppercase tracking-cta text-ink-grey">{t("payments")}</th>
                  <th scope="col" className="p-3 text-xs uppercase tracking-cta text-ink-grey">{t("details")}</th>
                </tr>
              </thead>
              <tbody>
                {iscrizioni.map((i) => {
                  const age = i.birthDate ? calcAge(i.birthDate, campStart) : (i.age ?? "—");
                  return (
                    <tr key={i.id} className="border-b border-ink-grey-light/60 hover:bg-sand">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="row-check w-4 h-4 cursor-pointer"
                          value={i.id}
                          aria-label={t("selectRow")}
                        />
                      </td>
                      <td className="p-3 font-bold">
                        {i.firstName} {i.lastName}
                        {i.isMinor && <span className="tag tag-orange ml-2">{locale === "it" ? "minore" : "minor"}</span>}
                      </td>
                      <td className="p-3">{i.email ? <a href={`mailto:${i.email}`} className="text-wwf-green hover:underline">{i.email}</a> : "—"}</td>
                      <td className="p-3"><a href={`tel:${i.phone}`} className="hover:underline">{i.phone || "—"}</a></td>
                      <td className="p-3">{locale === "it" ? "Campo" : "Camp"} {i.turno.number}</td>
                      <td className="p-3">{age}</td>
                      <td className="p-3">
                        <IscrizioneRowControls id={i.id} status={i.status} feePaid={i.feePaid} balancePaid={i.balancePaid} notes={i.notes} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <ViewVolunteer iscrizione={{
                            id: i.id, firstName: i.firstName, lastName: i.lastName,
                            birthDate: i.birthDate ? i.birthDate.toISOString() : null, age: i.age,
                            email: i.email, phone: i.phone, isMinor: i.isMinor,
                            guardianName: i.guardianName, guardianEmail: i.guardianEmail, guardianPhone: i.guardianPhone,
                            guardianConsent: i.guardianConsent, allergies: i.allergies, medications: i.medications,
                            swimmingAbility: i.swimmingAbility, tetanusStatus: i.tetanusStatus, fitnessSelf: i.fitnessSelf,
                            dietaryNeeds: i.dietaryNeeds, dietaryNotes: i.dietaryNotes, tshirtSize: i.tshirtSize,
                            arrivalMode: i.arrivalMode, arrivalTime: i.arrivalTime, departureTime: i.departureTime,
                            status: i.status, feePaid: i.feePaid, feePaidDate: i.feePaidDate?.toISOString() ?? null,
                            balancePaid: i.balancePaid, balancePaidDate: i.balancePaidDate?.toISOString() ?? null,
                            notes: i.notes, imageDataConsent: i.imageDataConsent, marketingConsent: i.marketingConsent,
                            privacyConsent: i.privacyConsent, turnoNumber: i.turno.number,
                            turnoStart: i.turno.startDate.toISOString(), turnoEnd: i.turno.endDate.toISOString(),
                            extraTurnoNumbers: i.iscrizioneTurni.filter((it) => !it.isPrimary).map((it) => it.turno.number),
                            createdAt: i.createdAt.toISOString()
                          }} />
                          <EditVolunteer iscrizione={{
                            id: i.id, firstName: i.firstName, lastName: i.lastName,
                            birthDate: i.birthDate ? i.birthDate.toISOString() : null, age: i.age,
                            email: i.email, phone: i.phone, isMinor: i.isMinor,
                            guardianName: i.guardianName, guardianEmail: i.guardianEmail, guardianPhone: i.guardianPhone,
                            allergies: i.allergies, medications: i.medications,
                            swimmingAbility: i.swimmingAbility, tetanusStatus: i.tetanusStatus, fitnessSelf: i.fitnessSelf,
                            dietaryNeeds: i.dietaryNeeds, dietaryNotes: i.dietaryNotes, tshirtSize: i.tshirtSize,
                            arrivalMode: i.arrivalMode, arrivalTime: i.arrivalTime, departureTime: i.departureTime,
                            status: i.status, feePaid: i.feePaid, balancePaid: i.balancePaid,
                            notes: i.notes, imageDataConsent: i.imageDataConsent
                          }} />
                          <DeleteVolunteer id={i.id} name={`${i.firstName} ${i.lastName}`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-between mt-6 gap-3 flex-wrap" aria-label={t("page")}>
              <p className="text-sm text-ink-grey">
                {t("page")} {safePage} {t("of")} {totalPages}
              </p>
              <div className="flex gap-2">
                {safePage > 1 ? (
                  <Link href={buildHref(safePage - 1)} className="btn btn-outline text-sm px-4 py-2">
                    <ChevronLeft size={16} /> {t("previous")}
                  </Link>
                ) : (
                  <span className="btn btn-outline text-sm px-4 py-2 opacity-50 cursor-not-allowed">
                    <ChevronLeft size={16} /> {t("previous")}
                  </span>
                )}
                {safePage < totalPages ? (
                  <Link href={buildHref(safePage + 1)} className="btn btn-outline text-sm px-4 py-2">
                    {t("next")} <ChevronRight size={16} />
                  </Link>
                ) : (
                  <span className="btn btn-outline text-sm px-4 py-2 opacity-50 cursor-not-allowed">
                    {t("next")} <ChevronRight size={16} />
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}