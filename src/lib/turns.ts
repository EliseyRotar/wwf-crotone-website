import { prisma } from "@/lib/prisma";

export type TurnStatus = "available" | "few" | "full" | "past";

export function getTurnStatus(booked: number, capacity: number, endDate: Date, isActive: boolean = true): TurnStatus {
  if (!isActive) return "past";
  const now = new Date();
  if (endDate.getTime() < now.getTime()) return "past";
  if (booked >= capacity) return "full";
  if (booked >= capacity * 0.8) return "few";
  return "available";
}

export function fmtDate(d: Date, locale: string = "it"): string {
  return d.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export function fmtDateShort(d: Date, locale: string = "it"): string {
  return d.toLocaleDateString(locale === "it" ? "it-IT" : "en-GB", {
    day: "numeric",
    month: "short"
  });
}

export function fmtDateRange(start: Date, end: Date, locale: string = "it"): string {
  const s = fmtDateShort(start, locale);
  const e = fmtDate(end, locale);
  return `${s} - ${e}`;
}

let cachedCampStart: { startDate: Date; age: number } | null = null;

export async function getCampStart(): Promise<{ startDate: Date; age: number }> {
  if (cachedCampStart) return cachedCampStart;
  try {
    const settings = await prisma.campSettings.findFirst({
      orderBy: { createdAt: "desc" }
    });
    if (settings?.startDate) {
      cachedCampStart = { startDate: settings.startDate, age: settings.year };
      return cachedCampStart;
    }
  } catch {}
  const fallback = new Date(`${new Date().getFullYear()}-06-21`);
  cachedCampStart = { startDate: fallback, age: fallback.getFullYear() };
  return cachedCampStart;
}

export function invalidateCampStartCache() {
  cachedCampStart = null;
}

export function calcAge(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear();
  const hadBirthday =
    ref.getMonth() > birth.getMonth() ||
    (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  return age;
}

export function isUnder18(birth: Date, ref: Date): boolean {
  return calcAge(birth, ref) < 18;
}
