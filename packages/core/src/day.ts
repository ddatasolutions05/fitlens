export type DayStatus = 'not_logged' | 'partial' | 'complete';

/** A saved status wins. Otherwise any log makes the day partial. */
export function dayStatusFrom(row: { status: 'partial' | 'complete' } | null | undefined, hasAnyLog: boolean): DayStatus {
  if (row) return row.status;
  return hasAnyLog ? 'partial' : 'not_logged';
}

export function consistency(statuses: DayStatus[]): {
  complete: number;
  partial: number;
  notLogged: number;
  total: number;
  label: string;
} {
  let complete = 0;
  let partial = 0;
  let notLogged = 0;
  for (const s of statuses) {
    if (s === 'complete') complete += 1;
    else if (s === 'partial') partial += 1;
    else notLogged += 1;
  }
  const total = statuses.length;
  return { complete, partial, notLogged, total, label: `${complete} of ${total} ${total === 1 ? 'day' : 'days'} complete` };
}
