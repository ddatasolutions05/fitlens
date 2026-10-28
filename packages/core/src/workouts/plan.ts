// A weekly plan from a few settings. Rules, not AI: the same settings always
// give the same week, and the seed rotates the choice within each slot.
import { availableWorkouts, workoutById, type Equipment, type Focus, type Level, type Pattern, type Workout } from './library';

export interface PlanSettings {
  daysPerWeek: number;
  minutes: number;
  level: Level;
  focus: Focus;
  equipment: Equipment[];
  seed: number;
}

export interface PlanDay {
  /** 0 is Monday, 6 is Sunday. */
  weekday: number;
  workoutId: string | null;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const TEMPLATES: Record<Focus, Record<number, Pattern[]>> = {
  general: {
    1: ['full'],
    2: ['full', 'cardio'],
    3: ['full', 'cardio', 'full'],
    4: ['full', 'cardio', 'full', 'mobility'],
    5: ['upper', 'lower', 'cardio', 'full', 'mobility'],
    6: ['upper', 'lower', 'cardio', 'full', 'intervals', 'mobility'],
    7: ['upper', 'lower', 'cardio', 'full', 'intervals', 'mobility', 'cardio'],
  },
  strength: {
    1: ['full'],
    2: ['upper', 'lower'],
    3: ['upper', 'lower', 'full'],
    4: ['upper', 'lower', 'upper', 'lower'],
    5: ['push', 'pull', 'lower', 'upper', 'core'],
    6: ['push', 'pull', 'lower', 'push', 'pull', 'lower'],
    7: ['push', 'pull', 'lower', 'push', 'pull', 'lower', 'mobility'],
  },
  fat_loss: {
    1: ['full'],
    2: ['full', 'intervals'],
    3: ['full', 'intervals', 'full'],
    4: ['full', 'intervals', 'full', 'cardio'],
    5: ['full', 'intervals', 'lower', 'cardio', 'full'],
    6: ['full', 'intervals', 'lower', 'cardio', 'upper', 'cardio'],
    7: ['full', 'intervals', 'lower', 'cardio', 'upper', 'cardio', 'mobility'],
  },
  endurance: {
    1: ['cardio'],
    2: ['cardio', 'full'],
    3: ['cardio', 'full', 'cardio'],
    4: ['cardio', 'full', 'intervals', 'cardio'],
    5: ['cardio', 'full', 'intervals', 'cardio', 'mobility'],
    6: ['cardio', 'full', 'intervals', 'cardio', 'full', 'cardio'],
    7: ['cardio', 'full', 'intervals', 'cardio', 'full', 'cardio', 'mobility'],
  },
  mobility: {
    1: ['mobility'],
    2: ['mobility', 'full'],
    3: ['mobility', 'full', 'cardio'],
    4: ['mobility', 'full', 'cardio', 'mobility'],
    5: ['mobility', 'full', 'cardio', 'mobility', 'core'],
    6: ['mobility', 'full', 'cardio', 'mobility', 'core', 'cardio'],
    7: ['mobility', 'full', 'cardio', 'mobility', 'core', 'cardio', 'mobility'],
  },
};

const FALLBACK: Record<Pattern, Pattern[]> = {
  full: ['upper', 'lower', 'core'],
  upper: ['full', 'push', 'pull'],
  lower: ['full'],
  push: ['upper', 'full'],
  pull: ['upper', 'full'],
  core: ['mobility', 'full'],
  cardio: ['intervals', 'mobility'],
  intervals: ['cardio'],
  mobility: ['core', 'cardio'],
};

/** Training days spread across the week, Monday first. */
export function spreadDays(n: number): number[] {
  const days = Math.max(1, Math.min(7, Math.round(n)));
  const out: number[] = [];
  for (let i = 0; i < days; i += 1) out.push(Math.min(6, Math.round((i * 7) / days)));
  return Array.from(new Set(out));
}

function pick(candidates: Workout[], s: PlanSettings, slot: number, used: Set<string>): Workout | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => {
    const fa = a.focus.includes(s.focus) ? 0 : 1;
    const fb = b.focus.includes(s.focus) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return Math.abs(a.minutes - s.minutes) - Math.abs(b.minutes - s.minutes);
  });
  const fresh = ranked.filter((w) => !used.has(w.id));
  const pool = fresh.length > 0 ? fresh : ranked;
  const top = pool.slice(0, Math.min(3, pool.length));
  return top[(Math.abs(s.seed) + slot) % top.length]!;
}

export function buildWeeklyPlan(s: PlanSettings): PlanDay[] {
  const days = Math.max(1, Math.min(7, Math.round(s.daysPerWeek)));
  const patterns = TEMPLATES[s.focus][days] ?? TEMPLATES.general[days]!;
  const available = availableWorkouts({ equipment: s.equipment, level: s.level });
  const weekdays = spreadDays(days);
  const used = new Set<string>();
  const chosen: (string | null)[] = patterns.map((pattern, i) => {
    const tries = [pattern, ...FALLBACK[pattern]];
    for (const p of tries) {
      const w = pick(
        available.filter((x) => x.pattern === p),
        s,
        i,
        used,
      );
      if (w) {
        used.add(w.id);
        return w.id;
      }
    }
    return null;
  });
  return WEEKDAYS.map((_, weekday) => {
    const slot = weekdays.indexOf(weekday);
    return { weekday, workoutId: slot >= 0 ? (chosen[slot] ?? null) : null };
  });
}

/** Monday-based weekday (0 to 6) for a local date. */
export function weekdayOf(localDate: string): number {
  const d = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

export interface TodaySuggestion {
  workout: Workout;
  /** Planned for today, or an optional easy session on a rest day. */
  planned: boolean;
}

export function suggestionsForDay(i: { plan: PlanDay[]; localDate: string; settings: PlanSettings }): TodaySuggestion[] {
  const weekday = weekdayOf(i.localDate);
  const planned = i.plan.find((d) => d.weekday === weekday)?.workoutId ?? null;
  const out: TodaySuggestion[] = [];
  if (planned) {
    const w = workoutById(planned);
    if (w) out.push({ workout: w, planned: true });
  }
  const available = availableWorkouts({ equipment: i.settings.equipment, level: i.settings.level });
  const easy = available.filter((w) => (w.pattern === 'mobility' || w.pattern === 'cardio' || w.pattern === 'core') && w.id !== planned && w.intensity !== 'vigorous');
  for (const w of easy.slice(0, planned ? 1 : 2)) out.push({ workout: w, planned: false });
  return out;
}

export function planMinutesPerWeek(plan: PlanDay[]): number {
  return plan.reduce((sum, d) => sum + (d.workoutId ? (workoutById(d.workoutId)?.minutes ?? 0) : 0), 0);
}
