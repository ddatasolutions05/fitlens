/** Lowercase, accents stripped, punctuation to spaces, single spaced. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Dice coefficient on character bigrams of the normalized names, 0 to 1. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a).replace(/ /g, '');
  const y = normalizeName(b).replace(/ /g, '');
  if (x === y) return x.length > 0 ? 1 : 0;
  if (x.length < 2 || y.length < 2) return 0;
  const bx = bigrams(x);
  const by = bigrams(y);
  let overlap = 0;
  for (const [g, n] of bx) overlap += Math.min(n, by.get(g) ?? 0);
  return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

export const MATCH_THRESHOLD = 0.55;

/** Highest scoring candidate at or above the threshold, or null. */
export function bestMatch<T>(
  query: string,
  candidates: T[],
  getName: (c: T) => string,
  threshold = MATCH_THRESHOLD,
): { candidate: T; score: number } | null {
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = similarity(query, getName(candidate));
    if (score >= threshold && (best == null || score > best.score)) best = { candidate, score };
  }
  return best;
}
