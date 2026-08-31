/**
 * Search APIs return dates in three shapes: ISO strings, localised absolute
 * dates, and English relative strings ("2 days ago"). Serper's /news endpoint
 * uses the third almost exclusively, so parsing it is not optional.
 */
const RELATIVE = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i;

const UNIT_MS: Record<string, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30d — good enough for freshness decay
  year: 31_536_000_000,
};

export function parsePublishedAt(
  input: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const rel = RELATIVE.exec(trimmed);
  if (rel) {
    const delta = Number(rel[1]) * UNIT_MS[rel[2].toLowerCase()];
    return Number.isFinite(delta) ? new Date(now.getTime() - delta) : null;
  }

  // Date.parse is far too permissive: it turns "12" into 2001-12-01 and "3"
  // into 2001-03-01. Require something that actually looks like a date before
  // trusting it — a separator, a four-digit year, or a month name.
  if (!/[-/:.]|\d{4}|[a-z]{3}/i.test(trimmed) || trimmed.length < 6) return null;

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;

  const date = new Date(parsed);
  if (date.getFullYear() < 1990 || date.getTime() > now.getTime() + 86_400_000) {
    return null;
  }
  return date;
}
