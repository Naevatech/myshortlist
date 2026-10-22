const UK_TZ = 'Europe/London';

/** A calendar date in the UK, as YYYY-MM-DD. */
export function ukDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: UK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** A Date at UTC midnight for the UK calendar day, suitable for a DATE column. */
export function ukToday(d: Date = new Date()): Date {
  return new Date(`${ukDateString(d)}T00:00:00.000Z`);
}

/** 12 Oct 2026 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatUkDate(d: Date): string {
  const [y, m, day] = ukDateString(d).split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** Parses durations like "15m", "30d", "12h", "45s" into milliseconds. */
export function durationMs(value: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration: ${value}`);
  return Number(m[1]) * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
}
