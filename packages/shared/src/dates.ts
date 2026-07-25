const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD string into a UTC epoch-day number. */
export function epochDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`invalid date: ${date}`);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** Format an epoch-day number (or Date) as YYYY-MM-DD (UTC). */
export function isoDate(value: number | Date): string {
  const ms = value instanceof Date ? value.getTime() : value * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return isoDate(epochDay(date) + days);
}

/** b - a in whole days. */
export function daysBetween(a: string, b: string): number {
  return epochDay(b) - epochDay(a);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
