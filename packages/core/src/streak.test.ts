import { describe, expect, it } from 'vitest';

import { currentStreak, streakLabel } from './streak';

describe('currentStreak', () => {
  it('counts back from today when today has a log', () => {
    expect(currentStreak(['2026-10-26', '2026-10-27', '2026-10-28'], '2026-10-28')).toBe(3);
  });

  it('keeps counting from yesterday when today is not logged yet', () => {
    expect(currentStreak(['2026-10-26', '2026-10-27'], '2026-10-28')).toBe(2);
  });

  it('stops at a gap', () => {
    expect(currentStreak(['2026-10-24', '2026-10-26', '2026-10-27'], '2026-10-27')).toBe(2);
    expect(currentStreak(['2026-10-20'], '2026-10-28')).toBe(0);
  });

  it('labels only from two days', () => {
    expect(streakLabel(1)).toBeNull();
    expect(streakLabel(2)).toBe('2 days in a row');
  });
});
