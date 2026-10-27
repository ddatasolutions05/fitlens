const DAY_MS = 86_400_000;

function parseLocalDate(s: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`Expected YYYY-MM-DD, got "${s}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Midnight UTC for a calendar date. Used only for calendar maths. */
function utcMs(localDate: string): number {
  const [y, m, d] = parseLocalDate(localDate);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsCache.set(tz, f);
  }
  return f;
}

function wallClock(ms: number, tz: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number> {
  const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const p of wallClockFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type in out) out[p.type as keyof typeof out] = Number(p.value);
  }
  return out;
}

/** Offset of `tz` from UTC at an instant, in ms. */
function offsetMs(ms: number, tz: string): number {
  const w = wallClock(ms, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDateFor(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function todayLocal(tz?: string): string {
  return localDateFor(new Date(), tz ?? deviceTimeZone());
}

export function addDays(localDate: string, n: number): string {
  return fromUtcMs(utcMs(localDate) + n * DAY_MS);
}

/** Whole days from `a` to `b`. Positive when `b` is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcMs(b) - utcMs(a)) / DAY_MS);
}

export function formatLocalDate(localDate: string, style: 'short' | 'long' | 'relative' = 'short', today?: string): string {
  if (style === 'relative') {
    const diff = daysBetween(localDate, today ?? todayLocal());
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
  }
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      : { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(utcMs(localDate)));
}

/**
 * ISO instant for a wall-clock time in `tz`. In a DST gap the result lands
 * on the shifted side; in an overlap it picks the first offset found.
 */
export function localDateTimeToIso(localDate: string, hhmm: string, tz: string): string {
  const [y, m, d] = parseLocalDate(localDate);
  const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!t) throw new RangeError(`Expected HH:mm, got "${hhmm}"`);
  const wall = Date.UTC(y, m - 1, d, Number(t[1]), Number(t[2]));
  let guess = wall - offsetMs(wall, tz);
  for (let i = 0; i < 3; i++) {
    const next = wall - offsetMs(guess, tz);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess).toISOString();
}

/** 'HH:mm' of an instant in a time zone. */
export function timeInZone(iso: string, tz: string): string {
  const w = wallClock(Date.parse(iso), tz);
  return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

/** Every date from `from` to `to`, inclusive. Empty when `from` is after `to`. */
export function dateRange(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}
