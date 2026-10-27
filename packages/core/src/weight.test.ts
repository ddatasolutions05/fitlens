import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { latestTrend, trendDirection, trendWeights } from './weight';

describe('trendWeights', () => {
  it('sorts, averages same-day weigh-ins and seeds with the first value', () => {
    const t = trendWeights([
      { localDate: '2026-10-03', kg: 79 },
      { localDate: '2026-10-01', kg: 80 },
      { localDate: '2026-10-02', kg: 81 },
      { localDate: '2026-10-02', kg: 79 },
    ]);
    expect(t.map((p) => p.localDate)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(t[0]?.trendKg).toBe(80);
    expect(t[1]?.kg).toBe(80);
    expect(t[1]?.trendKg).toBeCloseTo(80, 6);
    expect(t[2]?.trendKg).toBeCloseTo(79.9, 6);
  });

  it('empty input', () => {
    expect(trendWeights([])).toEqual([]);
    expect(latestTrend([])).toBeNull();
  });
});

describe('trendDirection', () => {
  const series = (start: number, step: number, n: number) =>
    trendWeights(Array.from({ length: n }, (_, i) => ({ localDate: addDays('2026-09-01', i), kg: start + step * i })), 0.5);

  it('down, up and flat', () => {
    expect(trendDirection(series(85, -0.2, 20))).toBe('down');
    expect(trendDirection(series(70, 0.2, 20))).toBe('up');
    expect(trendDirection(series(75, 0.005, 20))).toBe('flat');
  });

  it('unknown with fewer than 2 points', () => {
    expect(trendDirection(series(80, 0, 1))).toBe('unknown');
    expect(trendDirection([])).toBe('unknown');
  });

  it('unknown when the window holds only the latest point', () => {
    const t = trendWeights([
      { localDate: '2026-09-01', kg: 80 },
      { localDate: '2026-10-01', kg: 78 },
    ]);
    expect(trendDirection(t, 7)).toBe('unknown');
    expect(trendDirection(t, 30)).toBe('down');
  });

  it('latest point', () => {
    expect(latestTrend(series(80, 0, 5))?.localDate).toBe('2026-09-05');
  });
});
