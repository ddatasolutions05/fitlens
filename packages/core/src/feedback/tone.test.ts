import { describe, expect, it } from 'vitest';
import { BANNED_WORDS, violatesTone } from './tone';

describe('violatesTone', () => {
  it('finds banned phrases regardless of case', () => {
    expect(violatesTone('That was a CHEAT meal')).toEqual(['cheat']);
    expect(violatesTone('No need to feel guilty')).toEqual(['guilty']);
    expect(violatesTone('You can walk off the extra')).toEqual(['walk off']);
    expect(violatesTone('Good  food choice')).toEqual(['good food']);
  });

  it('matches on word boundaries only', () => {
    expect(violatesTone('Learn more about fibre')).toEqual([]);
    expect(violatesTone('Junction of two meals')).toEqual([]);
    expect(violatesTone('A good choice for food lovers')).toEqual([]);
  });

  it('every banned phrase is caught on its own', () => {
    for (const w of BANNED_WORDS) expect(violatesTone(`x ${w} x`)).toContain(w);
  });

  it('clean text passes', () => {
    expect(violatesTone('This meal adds 28 g protein, leaving 62 g for today.')).toEqual([]);
  });
});
