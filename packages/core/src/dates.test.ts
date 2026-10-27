import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  daysBetween,
  deviceTimeZone,
  formatLocalDate,
  localDateFor,
  localDateTimeToIso,
  timeInZone,
  todayLocal,
} from './dates';

describe('localDateFor', () => {
  it('uses the zone, not UTC', () => {
    const instant = new Date('2026-10-25T03:30:00Z');
    expect(localDateFor(instant, 'America/Toronto')).toBe('2026-10-24');
    expect(localDateFor(instant, 'UTC')).toBe('2026-10-25');
    expect(localDateFor(instant, 'Asia/Kolkata')).toBe('2026-10-25');
  });

  it('Kolkata after its midnight', () => {
    expect(localDateFor(new Date('2026-10-24T18:45:00Z'), 'Asia/Kolkata')).toBe('2026-10-25');
    expect(localDateFor(new Date('2026-10-24T18:15:00Z'), 'Asia/Kolkata')).toBe('2026-10-24');
  });

  it('device zone and today', () => {
    expect(deviceTimeZone().length).toBeGreaterThan(0);
    expect(todayLocal('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('calendar maths', () => {
  it('adds days across month, year and leap day', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-07', 7)).toBe('2026-03-14');
  });

  it('days between', () => {
    expect(daysBetween('2026-10-01', '2026-10-24')).toBe(23);
    expect(daysBetween('2026-10-24', '2026-10-01')).toBe(-23);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('date range', () => {
    expect(dateRange('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('rejects malformed dates', () => {
    expect(() => addDays('2026/10/01', 1)).toThrow(RangeError);
  });
});

describe('formatLocalDate', () => {
  it('styles', () => {
    expect(formatLocalDate('2026-10-24', 'short')).toBe('Sat, Oct 24');
    expect(formatLocalDate('2026-10-24', 'long')).toBe('Saturday, October 24, 2026');
    expect(formatLocalDate('2026-10-24', 'relative', '2026-10-24')).toBe('Today');
    expect(formatLocalDate('2026-10-23', 'relative', '2026-10-24')).toBe('Yesterday');
    expect(formatLocalDate('2026-10-20', 'relative', '2026-10-24')).toBe('Tue, Oct 20');
  });
});

describe('wall clock to instant', () => {
  it('Toronto 23:30 on Oct 24', () => {
    expect(localDateTimeToIso('2026-10-24', '23:30', 'America/Toronto')).toBe('2026-10-25T03:30:00.000Z');
  });

  it('Toronto in winter', () => {
    expect(localDateTimeToIso('2026-12-01', '08:00', 'America/Toronto')).toBe('2026-12-01T13:00:00.000Z');
  });

  it('Kolkata', () => {
    expect(localDateTimeToIso('2026-10-25', '00:15', 'Asia/Kolkata')).toBe('2026-10-24T18:45:00.000Z');
  });

  it('round trips with timeInZone and localDateFor', () => {
    const zones = ['America/Toronto', 'Asia/Kolkata', 'Europe/London', 'Australia/Sydney', 'UTC', 'America/Los_Angeles'];
    const dates = ['2026-01-15', '2026-03-29', '2026-07-04', '2026-10-24', '2026-11-01'];
    const times = ['00:00', '06:45', '12:30', '23:59'];
    for (const tz of zones) {
      for (const d of dates) {
        for (const t of times) {
          const iso = localDateTimeToIso(d, t, tz);
          expect(timeInZone(iso, tz)).toBe(t);
          expect(localDateFor(new Date(iso), tz)).toBe(d);
        }
      }
    }
  });

  it('timeInZone', () => {
    expect(timeInZone('2026-10-25T03:30:00Z', 'America/Toronto')).toBe('23:30');
    expect(timeInZone('2026-10-25T03:30:00Z', 'Asia/Kolkata')).toBe('09:00');
  });
});
