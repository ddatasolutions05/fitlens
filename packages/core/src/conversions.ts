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

/** Water in the person's units: "250 ml" or "8 fl oz". */
export function formatWater(ml: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') return `${Math.round(mlToFlOz(ml))} fl oz`;
  return `${Math.round(ml).toLocaleString()} ml`;
}

export function waterUnit(unitSystem: UnitSystem): 'ml' | 'fl oz' {
  return unitSystem === 'imperial' ? 'fl oz' : 'ml';
}

/** Millilitres shown as the unit's number, for bars and inputs. */
export function waterValue(ml: number | null, unitSystem: UnitSystem): number | null {
  if (ml == null) return null;
  return unitSystem === 'imperial' ? Math.round(mlToFlOz(ml)) : Math.round(ml);
}

/** Quick-add amounts in millilitres that read as round numbers in each unit. */
export const WATER_QUICK_ML: Record<UnitSystem, number[]> = { metric: [250, 500, 750], imperial: [237, 473, 710] };
