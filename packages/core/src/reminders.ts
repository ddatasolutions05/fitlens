// Daily reminder timing and copy. The sender runs every few minutes in UTC;
// each person has a local time and a timezone, so "due" is decided here.

export interface LocalClock {
  localDate: string;
  /** Minutes since local midnight. */
  minutes: number;
}

export function localClockIn(tz: string, date = new Date()): LocalClock {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (t: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === t)?.value ?? '00';
    const hour = Number(get('hour')) % 24;
    return { localDate: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + Number(get('minute')) };
  } catch {
    return { localDate: date.toISOString().slice(0, 10), minutes: date.getUTCHours() * 60 + date.getUTCMinutes() };
  }
}

export interface ReminderDueInput {
  now: Date;
  /** HH:MM or HH:MM:SS, local to tz. */
  localTime: string;
  tz: string;
  lastSentOn: string | null;
  /** How long after the chosen time a send still counts. */
  windowMinutes?: number;
}

/** Due when the local clock is inside the window after the chosen time and nothing went out today. */
export function isReminderDue(i: ReminderDueInput): { due: boolean; localDate: string } {
  const clock = localClockIn(i.tz, i.now);
  const [h = NaN, m = NaN] = i.localTime.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { due: false, localDate: clock.localDate };
  const target = h * 60 + m;
  const window = i.windowMinutes ?? 15;
  const inWindow = clock.minutes >= target && clock.minutes < target + window;
  return { due: inWindow && i.lastSentOn !== clock.localDate, localDate: clock.localDate };
}

export interface ReminderMessage {
  title: string;
  body: string;
}

/** One line for the hour of day; no numbers, no judgement. */
export function reminderMessage(localHour: number): ReminderMessage {
  if (localHour >= 5 && localHour <= 10) return { title: 'Log breakfast?', body: 'A minute now keeps the day honest.' };
  if (localHour >= 11 && localHour <= 15) return { title: 'Log lunch?', body: 'Search, type it, or photograph the plate.' };
  if (localHour >= 16 && localHour <= 21) return { title: 'Log dinner?', body: "Today's line is one meal away." };
  return { title: "Log today's meals?", body: 'Whatever you had, it counts.' };
}
