const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Whole number with thousands separators, e.g. 1,780. */
export function formatInt(n: number): string {
  return intFmt.format(Math.round(n));
}

/** Number with up to `digits` decimals and thousands separators. */
export function formatNumber(n: number, digits: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
}
