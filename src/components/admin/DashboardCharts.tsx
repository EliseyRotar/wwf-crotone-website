"use client";

import { useTranslations } from "next-intl";

type TurnoData = { number: number; booked: number; capacity: number };
type IscrData = { date: string; age: number };

export default function DashboardCharts({ turni, iscrizioni }: {
  turni: TurnoData[];
  iscrizioni: IscrData[];
}) {
  const t = useTranslations("Admin.dashboard");
  const maxBooked = Math.max(...turni.map((t) => t.booked), 1);

  // Registrations by day
  const byDate: Record<string, number> = {};
  iscrizioni.forEach((i) => { byDate[i.date] = (byDate[i.date] || 0) + 1; });
  const dates = Object.keys(byDate).sort();
  const dateValues = dates.map((d) => byDate[d]);
  const maxDateVal = Math.max(...dateValues, 1);

  // Age distribution
  const ageGroups: Record<string, number> = { "<18": 0, "18-25": 0, "26-35": 0, "36-50": 0, "51+": 0 };
  iscrizioni.forEach((i) => {
    if (i.age < 18) ageGroups["<18"]++;
    else if (i.age <= 25) ageGroups["18-25"]++;
    else if (i.age <= 35) ageGroups["26-35"]++;
    else if (i.age <= 50) ageGroups["36-50"]++;
    else ageGroups["51+"]++;
  });
  const ageMax = Math.max(...Object.values(ageGroups), 1);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Turn fill rate */}
      <div className="card">
        <div className="card-body">
          <h3 className="font-head text-lg mb-4 text-[var(--ad-text)]">{t("campoFillRate")}</h3>
          <div className="space-y-2">
            {turni.map((t) => {
              const pct = (t.booked / t.capacity) * 100;
              return (
                <div key={t.number} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-8 shrink-0 text-[var(--ad-text-muted)]">C{t.number}</span>
                  <div className="flex-1 h-6 bg-[var(--ad-bg-sunken)] overflow-hidden relative">
                    <div
                      className="h-full bg-[var(--ad-accent)] transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-semibold">
                      {t.booked}/{t.capacity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Registrations over time */}
      {dates.length > 0 && (
        <div className="card">
          <div className="card-body">
            <h3 className="font-head text-lg mb-4 text-[var(--ad-text)]">{t("registrationsOverTime")}</h3>
            <div className="flex items-end gap-1 h-32">
              {dateValues.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[var(--ad-accent)]/70 hover:bg-[var(--ad-accent)] transition-colors"
                  style={{ height: `${(v / maxDateVal) * 100}%` }}
                  title={`${dates[i]}: ${v}`}
                />
              ))}
            </div>
            <p className="text-xs text-[var(--ad-text-muted)] mt-2">{dates.length} {t("days")} — {t("first")}: {dates[0]}, {t("last")}: {dates[dates.length - 1]}</p>
          </div>
        </div>
      )}

      {/* Age distribution */}
      <div className="card">
        <div className="card-body">
          <h3 className="font-head text-lg mb-4 text-[var(--ad-text)]">{t("ageDistribution")}</h3>
          <div className="space-y-2">
            {Object.entries(ageGroups).map(([label, count]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs font-semibold w-12 shrink-0 text-[var(--ad-text-muted)]">{label}</span>
                <div className="flex-1 h-5 bg-[var(--ad-bg-sunken)] overflow-hidden relative">
                  <div
                    className="h-full bg-[var(--ad-warning)]/80"
                    style={{ width: `${(count / ageMax) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-[var(--ad-text)]">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}