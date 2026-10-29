import { describe, expect, it } from 'vitest';
import { isReminderDue, localClockIn, reminderMessage } from './reminders';
import { violatesTone } from './feedback/tone';

describe('localClockIn', () => {
  it('reads the local date and minutes for a timezone', () => {
    const c = localClockIn('America/Toronto', new Date('2026-10-29T23:30:00Z'));
    expect(c).toEqual({ localDate: '2026-10-29', minutes: 19 * 60 + 30 });
    const k = localClockIn('Asia/Kolkata', new Date('2026-10-29T23:30:00Z'));
    expect(k).toEqual({ localDate: '2026-10-30', minutes: 5 * 60 });
  });

  it('falls back to UTC for an unknown zone', () => {
    const c = localClockIn('Nowhere/Land', new Date('2026-10-29T00:05:00Z'));
    expect(c).toEqual({ localDate: '2026-10-29', minutes: 5 });
  });
});

describe('isReminderDue', () => {
  const tz = 'America/Toronto';
  it('is due inside the window after the chosen time, once a day', () => {
    const at = new Date('2026-10-30T00:03:00Z'); // 20:03 Toronto
    expect(isReminderDue({ now: at, localTime: '20:00', tz, lastSentOn: null })).toEqual({ due: true, localDate: '2026-10-29' });
    expect(isReminderDue({ now: at, localTime: '20:00:00', tz, lastSentOn: '2026-10-29' }).due).toBe(false);
    expect(isReminderDue({ now: at, localTime: '20:00', tz, lastSentOn: '2026-10-28' }).due).toBe(true);
  });

  it('is not due before the time or after the window', () => {
    expect(isReminderDue({ now: new Date('2026-10-29T23:58:00Z'), localTime: '20:00', tz, lastSentOn: null }).due).toBe(false);
    expect(isReminderDue({ now: new Date('2026-10-30T00:16:00Z'), localTime: '20:00', tz, lastSentOn: null }).due).toBe(false);
    expect(isReminderDue({ now: new Date('2026-10-30T00:16:00Z'), localTime: '20:00', tz, lastSentOn: null, windowMinutes: 30 }).due).toBe(true);
  });

  it('ignores a malformed time', () => {
    expect(isReminderDue({ now: new Date(), localTime: 'soon', tz, lastSentOn: null }).due).toBe(false);
  });
});

describe('reminderMessage', () => {
  it('names the meal for the hour and stays calm', () => {
    expect(reminderMessage(8).title).toBe('Log breakfast?');
    expect(reminderMessage(13).title).toBe('Log lunch?');
    expect(reminderMessage(19).title).toBe('Log dinner?');
    expect(reminderMessage(23).title).toBe("Log today's meals?");
    for (const h of [8, 13, 19, 23]) {
      const m = reminderMessage(h);
      expect(violatesTone(`${m.title} ${m.body}`)).toEqual([]);
    }
  });
});
