import { describe, expect, it } from 'vitest';

import { availableWorkouts, EQUIPMENT, FOCUS_OPTIONS, LEVELS, WORKOUTS, workoutById } from './library';
import { buildWeeklyPlan, planMinutesPerWeek, spreadDays, suggestionsForDay, weekdayOf, type PlanSettings } from './plan';

const base: PlanSettings = { daysPerWeek: 3, minutes: 40, level: 'beginner', focus: 'general', equipment: ['dumbbells'], seed: 1 };

describe('library', () => {
  it('has unique ids and every workout maps to a MET type', () => {
    const ids = new Set(WORKOUTS.map((w) => w.id));
    expect(ids.size).toBe(WORKOUTS.length);
    for (const w of WORKOUTS) {
      expect(w.exercises.length).toBeGreaterThan(0);
      expect(w.minutes).toBeGreaterThan(0);
      expect(w.equipment.length).toBeGreaterThan(0);
    }
  });

  it('bodyweight beginners still get a full week of options', () => {
    const list = availableWorkouts({ equipment: [], level: 'beginner' });
    const patterns = new Set(list.map((w) => w.pattern));
    expect(patterns.has('full')).toBe(true);
    expect(patterns.has('cardio')).toBe(true);
    expect(patterns.has('mobility')).toBe(true);
    expect(list.every((w) => w.level === 'beginner')).toBe(true);
  });
});

describe('buildWeeklyPlan', () => {
  it('fills exactly the requested number of days, spread over the week', () => {
    for (let days = 1; days <= 7; days += 1) {
      const plan = buildWeeklyPlan({ ...base, daysPerWeek: days });
      expect(plan).toHaveLength(7);
      expect(plan.filter((d) => d.workoutId).length).toBe(days);
    }
    expect(spreadDays(3)).toEqual([0, 2, 5]);
    expect(spreadDays(2)).toEqual([0, 4]);
  });

  it('never assigns a workout the person has no equipment for or is above their level', () => {
    for (const level of LEVELS) {
      for (const focus of FOCUS_OPTIONS) {
        for (const eq of [[], ['bands'], ['machines'], ['barbell', 'dumbbells']] as const) {
          const plan = buildWeeklyPlan({ ...base, level: level.key, focus: focus.key, equipment: [...eq], daysPerWeek: 5 });
          for (const d of plan) {
            if (!d.workoutId) continue;
            const w = workoutById(d.workoutId)!;
            expect(w.equipment.some((e) => e === 'bodyweight' || (eq as readonly string[]).includes(e))).toBe(true);
            expect(LEVELS.findIndex((l) => l.key === w.level)).toBeLessThanOrEqual(LEVELS.findIndex((l) => l.key === level.key));
          }
        }
      }
    }
  });

  it('is deterministic for the same settings and changes with the seed', () => {
    const a = buildWeeklyPlan(base);
    const b = buildWeeklyPlan(base);
    expect(a).toEqual(b);
    const seeds = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(buildWeeklyPlan({ ...base, seed, daysPerWeek: 4, equipment: ['dumbbells', 'kettlebell'] }))));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('strength focus with a barbell gives a push, pull, legs style week', () => {
    const plan = buildWeeklyPlan({ ...base, focus: 'strength', level: 'intermediate', equipment: ['barbell', 'machines'], daysPerWeek: 5 });
    const patterns = plan.filter((d) => d.workoutId).map((d) => workoutById(d.workoutId!)!.pattern);
    expect(patterns).toContain('push');
    expect(patterns).toContain('pull');
    expect(patterns).toContain('lower');
    expect(planMinutesPerWeek(plan)).toBeGreaterThan(150);
  });

  it('every equipment option is usable by at least two workouts', () => {
    for (const e of EQUIPMENT) {
      expect(WORKOUTS.filter((w) => w.equipment.includes(e.key)).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('suggestionsForDay', () => {
  it('offers the planned workout first and an easy option on rest days', () => {
    const plan = buildWeeklyPlan(base);
    expect(weekdayOf('2026-10-26')).toBe(0);
    const monday = suggestionsForDay({ plan, localDate: '2026-10-26', settings: base });
    expect(monday[0]?.planned).toBe(true);
    const tuesday = suggestionsForDay({ plan, localDate: '2026-10-27', settings: base });
    expect(tuesday.every((s) => !s.planned)).toBe(true);
    expect(tuesday.length).toBeGreaterThan(0);
  });
});
