/**
 * Tiny relative-time helper. Returns a localized "… ago" string without
 * pulling in a heavy dependency like date-fns or dayjs. The window
 * refreshes every 30s on the caller side (the status page polls the
 * API every 30s, which rerenders everything), so we don't need a
 * client-side timer here.
 *
 * Thresholds:
 *   < 60s  → "now" / "adesso"
 *   < 60m  → "5 minuti fa" / "5 minutes ago"
 *   < 24h  → "3 ore fa"    / "3 hours ago"
 *   else   → "2 giorni fa" / "2 days ago"
 *
 * The strings here are deliberately hard-coded for the two locales we
 * ship — the next-intl plural rules add a lot of verbosity for two
 * languages and four buckets.
 */
export function getRelativeTime(
  iso: string,
  t: (key: "now" | "minutes" | "hours" | "days", vars?: { n: number }) => string
): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, now - ts) / 1000;

  if (diff < 60) return t("now");
  const minutes = Math.round(diff / 60);
  if (minutes < 60) return t("minutes", { n: minutes });
  const hours = Math.round(diff / 3600);
  if (hours < 24) return t("hours", { n: hours });
  const days = Math.round(diff / 86400);
  return t("days", { n: days });
}
