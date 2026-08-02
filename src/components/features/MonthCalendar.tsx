"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TurnLite = {
  id: string;
  number: number;
  startDate: string; // ISO
  endDate: string;   // ISO
  capacity: number;
  booked: number;
};

const MONTH_NAMES_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const WEEKDAY_SHORT_IT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const WEEKDAY_SHORT_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * F7: Public month-grid calendar view that lays all 12 turns over the months
 * they cover. Clicking a day with a turn scrolls to the form.
 */
export default function MonthCalendar({
  turni,
  locale
}: {
  turni: TurnLite[];
  locale: string;
}) {
  const months = MONTH_NAMES_IT;
  const weekdays = locale === "it" ? WEEKDAY_SHORT_IT : WEEKDAY_SHORT_EN;
  const isIt = locale === "it";

  const turniDates = useMemo(() =>
    turni.map((t) => ({
      ...t,
      start: new Date(t.startDate),
      end: new Date(t.endDate)
    })),
    [turni]
  );

  const firstTurn = turniDates.reduce((min, t) => (t.start < min ? t.start : min), turniDates[0]?.start ?? new Date());
  const lastTurn = turniDates.reduce((max, t) => (t.end > max ? t.end : max), turniDates[0]?.end ?? new Date());

  const [cursor, setCursor] = useState<Date>(() => startOfMonth(firstTurn));
  const monthLabel = `${months[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const total = daysInMonth(cursor);
  const firstWeekday = (cursor.getDay() + 6) % 7; // ISO: Mon=0
  const cells: ({ date: Date; turn: TurnLite } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    const turn = turniDates.find((t) => date >= t.start && date <= t.end) ?? null;
    cells.push(turn ? { date, turn } : null);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoBack = cursor.getTime() > startOfMonth(firstTurn).getTime();
  const canGoForward = cursor.getTime() < startOfMonth(lastTurn).getTime();

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => canGoBack && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            disabled={!canGoBack}
            className="p-2 rounded hover:bg-sand disabled:opacity-30"
            aria-label={isIt ? "Mese precedente" : "Previous month"}
          >
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-lg font-bold">{monthLabel}</h3>
          <button
            type="button"
            onClick={() => canGoForward && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            disabled={!canGoForward}
            className="p-2 rounded hover:bg-sand disabled:opacity-30"
            aria-label={isIt ? "Mese successivo" : "Next month"}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-cta text-ink-grey mb-1">
          {weekdays.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={idx} className="aspect-square" aria-hidden="true" />;
            const t = cell.turn!;
            const ratio = t.capacity > 0 ? t.booked / t.capacity : 0;
            const full = t.booked >= t.capacity;
            const few = !full && ratio >= 0.8;
            const bg = full ? "bg-wwf-red/15" : few ? "bg-wwf-orange/15" : "bg-wwf-green/15";
            return (
              <a
                key={idx}
                href={`#turn-${t.id}`}
                className={`aspect-square border border-ink-grey-light/40 rounded p-1 flex flex-col items-center justify-center text-xs ${bg} hover:ring-2 hover:ring-wwf-green transition`}
                aria-label={`${isIt ? "Campo" : "Camp"} ${t.number} · ${cell.date.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB")}`}
              >
                <span className="font-bold leading-none">{cell.date.getDate()}</span>
                <span className="text-[10px] text-ink-2 leading-none mt-0.5">C{t.number}</span>
              </a>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-ink-grey">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-wwf-green/40" /> {isIt ? "Posti disponibili" : "Available"}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-wwf-orange/40" /> {isIt ? "Pochi posti" : "Few spots"}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-wwf-red/40" /> {isIt ? "Completo" : "Full"}</span>
        </div>
      </div>
    </div>
  );
}
