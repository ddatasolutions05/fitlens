import { describe, expect, it } from 'vitest';
import { cmToFtIn, flOzToMl, formatHeight, formatWeight, ftInToCm, kgToLb, lbToKg, mlToFlOz } from './conversions';

describe('conversions', () => {
  it('kg and lb', () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
    expect(lbToKg(220.46)).toBeCloseTo(100, 2);
    for (let kg = 30; kg <= 250; kg += 7.3) {
      expect(Math.abs(lbToKg(kgToLb(kg)) - kg)).toBeLessThan(0.01);
    }
  });

  it('cm and ft/in', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, in: 10.9 });
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, in: 0 });
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34, 2);
    for (let cm = 120; cm <= 220; cm += 0.7) {
      const { ft, in: inches } = cmToFtIn(cm);
      expect(inches).toBeLessThan(12);
      expect(Math.abs(ftInToCm(ft, inches) - cm)).toBeLessThanOrEqual(0.5);
    }
  });

  it('ml and fl oz', () => {
    expect(mlToFlOz(240)).toBeCloseTo(8.12, 2);
    expect(flOzToMl(mlToFlOz(500))).toBeCloseTo(500, 6);
  });

  it('formats', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm');
    expect(formatHeight(180, 'imperial')).toBe('5 ft 11 in');
    expect(formatWeight(80, 'metric')).toBe('80.0 kg');
    expect(formatWeight(80, 'imperial')).toBe('176.4 lb');
    expect(formatWeight(80, 'imperial', 0)).toBe('176 lb');
  });
});
