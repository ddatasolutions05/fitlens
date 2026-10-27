import { describe, expect, it } from 'vitest';
import { consistency, dayStatusFrom } from './day';

describe('dayStatusFrom', () => {
  it('uses the saved status first', () => {
    expect(dayStatusFrom({ status: 'complete' }, false)).toBe('complete');
    expect(dayStatusFrom({ status: 'partial' }, true)).toBe('partial');
  });

  it('falls back to whether anything was logged', () => {
    expect(dayStatusFrom(null, true)).toBe('partial');
    expect(dayStatusFrom(undefined, false)).toBe('not_logged');
  });
});

describe('consistency', () => {
  it('counts and labels', () => {
    const r = consistency(['complete', 'complete', 'partial', 'complete', 'not_logged', 'complete', 'complete']);
    expect(r).toEqual({ complete: 5, partial: 1, notLogged: 1, total: 7, label: '5 of 7 days complete' });
  });

  it('singular and empty', () => {
    expect(consistency(['complete']).label).toBe('1 of 1 day complete');
    expect(consistency([]).label).toBe('0 of 0 days complete');
  });
});
