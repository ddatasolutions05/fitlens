import { describe, expect, it } from 'vitest';
import { MATCH_THRESHOLD, bestMatch, normalizeName, similarity } from './matching';

describe('normalizeName', () => {
  it('cleans case, accents and punctuation', () => {
    expect(normalizeName('  Crème Brûlée, (homemade) ')).toBe('creme brulee homemade');
    expect(normalizeName('Dal-Tadka!!')).toBe('dal tadka');
  });
});

describe('similarity', () => {
  it('is 1 for equal names and 0 for unrelated ones', () => {
    expect(similarity('Paneer Tikka', 'paneer tikka')).toBe(1);
    expect(similarity('rice', 'xyz')).toBe(0);
    expect(similarity('', '')).toBe(0);
  });

  it('is symmetric and bounded', () => {
    const s = similarity('chicken curry', 'curry chicken');
    expect(s).toBe(similarity('curry chicken', 'chicken curry'));
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('scores near spellings highly', () => {
    expect(similarity('dal tadka', 'daal tadka')).toBeGreaterThan(MATCH_THRESHOLD);
  });
});

describe('bestMatch', () => {
  const foods = [{ name: 'Toor dal, cooked' }, { name: 'Basmati rice, cooked' }, { name: 'Paneer' }];

  it('picks the highest score', () => {
    expect(bestMatch('toor daal cooked', foods, (f) => f.name)?.candidate.name).toBe('Toor dal, cooked');
    expect(bestMatch('basmati rice', foods, (f) => f.name)?.candidate.name).toBe('Basmati rice, cooked');
  });

  it('never returns a match below the threshold', () => {
    expect(bestMatch('chocolate cake', foods, (f) => f.name)).toBeNull();
    expect(bestMatch('paneer', foods, (f) => f.name, 1.01)).toBeNull();
    expect(bestMatch('anything', [], (f: { name: string }) => f.name)).toBeNull();
  });
});
