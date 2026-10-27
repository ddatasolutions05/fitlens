import { describe, expect, it } from 'vitest';
import { EMPTY_PER100, type Per100 } from '../nutrients';
import { postMealFeedback, type Feedback, type FeedbackInput } from './rules';
import { violatesTone } from './tone';

const meal = (p: Partial<Per100>): Per100 => ({ ...EMPTY_PER100, ...p });

const base: FeedbackInput = {
  meal: meal({ kcal: 520, protein_g: 28, fibre_g: 9, sodium_mg: 400 }),
  dayAfter: meal({ kcal: 1200, protein_g: 58, fibre_g: 18 }),
  targets: { calorieTarget: 1800, proteinG: 120, fibreG: 25 },
  preferences: { dietPattern: null, cuisines: [], allergies: [] },
  hideNumbers: false,
  mealItemNames: ['rice', 'chicken curry'],
};

const EXERCISE = /\b(exercis\w*|workouts?|walk\w*|run\w*|steps?|burn\w*|gym|cardio|training|active)\b/i;
const text = (f: Feedback) => [f.observation, f.suggestion, f.why ?? ''].join(' ');

describe('postMealFeedback', () => {
  it('reports protein from the given numbers', () => {
    const f = postMealFeedback(base);
    expect(f.observation).toBe('This meal is about 520 kcal and adds 28 g protein, leaving 62 g for today.');
  });

  it('suggests a protein side that fits the diet and cuisine', () => {
    const veg = postMealFeedback({ ...base, preferences: { dietPattern: 'vegetarian', cuisines: ['Indian'], allergies: [] } });
    expect(veg.suggestion).toMatch(/raita|sprouts|dal|paneer|curd/);
    expect(veg.suggestion).not.toMatch(/chicken|fish|egg/);
    const vegan = postMealFeedback({ ...base, preferences: { dietPattern: 'vegan', cuisines: [], allergies: [] } });
    expect(vegan.suggestion).toMatch(/tofu|chickpeas/);
    const egg = postMealFeedback({ ...base, preferences: { dietPattern: 'eggetarian', cuisines: [], allergies: [] } });
    expect(egg.suggestion).toMatch(/eggs/);
    const omni = postMealFeedback(base);
    expect(omni.suggestion).toMatch(/fish|eggs/);
    expect(omni.suggestion).not.toMatch(/chicken/);
    expect(omni.why).not.toBeNull();
  });

  it('respects allergies', () => {
    const f = postMealFeedback({
      ...base,
      preferences: { dietPattern: 'vegetarian', cuisines: ['Indian'], allergies: ['Dairy', 'lentils'] },
    });
    expect(f.suggestion).toBe('For more protein later today, a protein-rich side you like would fit.');
  });

  it('suggests fibre when the meal is low in it', () => {
    const f = postMealFeedback({ ...base, meal: meal({ kcal: 600, protein_g: 30, fibre_g: 2 }), dayAfter: meal({ kcal: 1200, protein_g: 100 }) });
    expect(f.suggestion).toMatch(/fibre/);
    expect(f.why).toMatch(/Fibre/);
  });

  it('stays neutral when over the calorie target', () => {
    const f = postMealFeedback({ ...base, dayAfter: meal({ kcal: 1950, protein_g: 70 }) });
    expect(f.suggestion).toBe('Today is at 1,950 of 1,800 kcal. Nothing to fix, tomorrow is a fresh day.');
    expect(f.why).toBeNull();
  });

  it('notes high sodium', () => {
    const f = postMealFeedback({ ...base, meal: meal({ kcal: 500, protein_g: 30, fibre_g: 10, sodium_mg: 1400 }), dayAfter: meal({ kcal: 1200, protein_g: 100 }) });
    expect(f.suggestion).toMatch(/salty/);
  });

  it('falls back to a balance line', () => {
    const f = postMealFeedback({ ...base, dayAfter: meal({ kcal: 1200, protein_g: 100 }) });
    expect(f.suggestion).toBe('A nice balance. Nothing to change here.');
  });

  it('hides numbers when asked', () => {
    const over = postMealFeedback({ ...base, hideNumbers: true, dayAfter: meal({ kcal: 1950, protein_g: 70 }) });
    expect(over.observation).toBe('This meal has plenty of protein and plenty of fibre.');
    expect(text(over)).not.toMatch(/\d/);
    const unknown = postMealFeedback({ ...base, hideNumbers: true, meal: EMPTY_PER100, dayAfter: EMPTY_PER100 });
    expect(unknown.observation).toMatch(/unknown/);
  });

  it('handles unknown nutrients without treating them as zero', () => {
    const f = postMealFeedback({ ...base, meal: EMPTY_PER100, dayAfter: EMPTY_PER100 });
    expect(f.observation).toBe('Protein and calories for this meal are unknown.');
    expect(f.suggestion).toBe('A nice balance. Nothing to change here.');
  });

  it('passes the tone rules and never mentions exercise for random inputs', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const maybe = (max: number) => (rand() < 0.2 ? null : Math.round(rand() * max * 10) / 10);
    const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T;
    const diets = [null, 'vegetarian', 'vegan', 'eggetarian', 'omnivore', 'pescatarian'];
    const cuisines = [[], ['Indian'], ['Italian'], ['Indian', 'Mexican']];
    const allergies = [[], ['dairy'], ['egg'], ['soy', 'fish'], ['lentils', 'milk']];

    for (let n = 0; n < 2000; n++) {
      const f = postMealFeedback({
        meal: meal({ kcal: maybe(1500), protein_g: maybe(80), fibre_g: maybe(20), sodium_mg: maybe(2500) }),
        dayAfter: meal({ kcal: maybe(3500), protein_g: maybe(200), fibre_g: maybe(50) }),
        targets: { calorieTarget: rand() < 0.2 ? null : 1400 + Math.round(rand() * 1600), proteinG: 60 + Math.round(rand() * 100), fibreG: rand() < 0.2 ? null : 25 },
        preferences: { dietPattern: pick(diets), cuisines: pick(cuisines), allergies: pick(allergies) },
        hideNumbers: rand() < 0.3,
        mealItemNames: pick([[], ['dal', 'rice'], ['eggs on toast'], ['salad']]),
      });
      const all = text(f);
      expect(violatesTone(all)).toEqual([]);
      expect(all).not.toMatch(EXERCISE);
      expect(all).not.toMatch(/[\u2013\u2014]/);
      expect(f.observation.length).toBeGreaterThan(0);
      expect(f.suggestion.length).toBeGreaterThan(0);
    }
  });
});
