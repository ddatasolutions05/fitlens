import { describe, expect, it } from 'vitest';

import { QUOTES, greetingFor, quoteForDate } from './quotes';

describe('quotes', () => {
  it('rotates daily and never repeats within the list length', () => {
    const seen = new Set<string>();
    for (let i = 0; i < QUOTES.length; i += 1) {
      const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      seen.add(quoteForDate(d));
    }
    expect(seen.size).toBe(QUOTES.length);
    expect(quoteForDate('2026-10-28')).toBe(quoteForDate('2026-10-28'));
  });

  it('keeps the tone rules: no shaming or compensation language', () => {
    for (const q of QUOTES) {
      expect(q).not.toMatch(/\b(cheat|junk|bad food|guilt|burn off|earn|punish|lazy|fat loss fails)\b/i);
      expect(q.length).toBeLessThanOrEqual(120);
    }
  });

  it('greets by hour', () => {
    expect(greetingFor(7)).toBe('Good morning');
    expect(greetingFor(13)).toBe('Good afternoon');
    expect(greetingFor(19)).toBe('Good evening');
    expect(greetingFor(23)).toBe('Good night');
    expect(greetingFor(2)).toBe('Still up');
  });
});
