export type UnitSystem = 'metric' | 'imperial';

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const ML_PER_FL_OZ = 29.5735295625;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;
export const mlToFlOz = (ml: number): number => ml / ML_PER_FL_OZ;
export const flOzToMl = (flOz: number): number => flOz * ML_PER_FL_OZ;

/** Feet and inches, inches to one decimal. */
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = Math.round((cm / CM_PER_IN) * 10) / 10;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round((totalIn - ft * 12) * 10) / 10;
  return { ft, in: inches };
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_IN;
}

export function formatHeight(cm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)} ft ${totalIn % 12} in`;
}

export function formatWeight(kg: number, unitSystem: UnitSystem, digits = 1): string {
  const value = unitSystem === 'metric' ? kg : kgToLb(kg);
  return `${value.toFixed(digits)} ${unitSystem === 'metric' ? 'kg' : 'lb'}`;
}
