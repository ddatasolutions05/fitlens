import { formatInt } from '../format';
import type { Per100 } from '../nutrients';

export interface FeedbackInput {
  meal: Per100;
  dayAfter: Per100;
  targets: { calorieTarget: number | null; proteinG: number; fibreG: number | null };
  preferences: { dietPattern: string | null; cuisines: string[]; allergies: string[] };
  hideNumbers: boolean;
  mealItemNames: string[];
}

export interface Feedback {
  observation: string;
  suggestion: string;
  why: string | null;
}

type Diet = 'vegetarian' | 'vegan' | 'eggetarian' | 'omnivore';
type Allergen = 'dairy' | 'egg' | 'fish' | 'soy' | 'legume';

interface Side {
  name: string;
  /** Word used to spot it among the meal's items. */
  key: string;
  allergens: Allergen[];
}

const S = (name: string, key: string, ...allergens: Allergen[]): Side => ({ name, key, allergens });

const PROTEIN_SIDES: Record<Diet, { indian: Side[]; other: Side[] }> = {
  vegetarian: {
    indian: [S('raita', 'raita', 'dairy'), S('sprouts', 'sprout', 'legume'), S('a katori of dal', 'dal', 'legume'), S('paneer', 'paneer', 'dairy'), S('curd', 'curd', 'dairy')],
    other: [S('yoghurt', 'yoghurt', 'dairy'), S('beans', 'bean', 'legume'), S('paneer', 'paneer', 'dairy'), S('sprouts', 'sprout', 'legume')],
  },
  vegan: {
    indian: [S('sprouts', 'sprout', 'legume'), S('a katori of dal', 'dal', 'legume'), S('chana', 'chana', 'legume'), S('soy chunks', 'soy', 'soy')],
    other: [S('tofu', 'tofu', 'soy'), S('chickpeas', 'chickpea', 'legume'), S('edamame', 'edamame', 'soy'), S('beans', 'bean', 'legume')],
  },
  eggetarian: {
    indian: [S('a boiled egg', 'egg', 'egg'), S('raita', 'raita', 'dairy'), S('sprouts', 'sprout', 'legume'), S('a katori of dal', 'dal', 'legume')],
    other: [S('eggs', 'egg', 'egg'), S('yoghurt', 'yoghurt', 'dairy'), S('beans', 'bean', 'legume')],
  },
  omnivore: {
    indian: [S('a katori of dal', 'dal', 'legume'), S('raita', 'raita', 'dairy'), S('sprouts', 'sprout', 'legume'), S('chicken', 'chicken'), S('fish', 'fish', 'fish'), S('eggs', 'egg', 'egg')],
    other: [S('chicken', 'chicken'), S('fish', 'fish', 'fish'), S('eggs', 'egg', 'egg'), S('yoghurt', 'yoghurt', 'dairy'), S('beans', 'bean', 'legume')],
  },
};

const FIBRE_SIDES = {
  indian: [S('a kachumber salad', 'kachumber'), S('a vegetable sabzi', 'sabzi'), S('a piece of fruit', 'fruit'), S('sprouts', 'sprout', 'legume')],
  other: [S('a side salad', 'salad'), S('a piece of fruit', 'fruit'), S('some vegetables', 'vegetable'), S('beans', 'bean', 'legume')],
};

const ALLERGY_WORDS: Record<Allergen, string[]> = {
  dairy: ['dairy', 'milk', 'lactose', 'paneer', 'curd', 'yoghurt', 'yogurt', 'casein'],
  egg: ['egg', 'eggs'],
  fish: ['fish', 'seafood'],
  soy: ['soy', 'soya', 'tofu'],
  legume: ['legume', 'legumes', 'pulse', 'pulses', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'bean', 'beans'],
};

function dietOf(pattern: string | null): Diet {
  const p = (pattern ?? '').toLowerCase();
  if (p.includes('vegan')) return 'vegan';
  if (p.includes('egg')) return 'eggetarian';
  if (p.includes('vegetarian')) return 'vegetarian';
  return 'omnivore';
}

function blockedAllergens(allergies: string[]): Set<Allergen> {
  const out = new Set<Allergen>();
  for (const a of allergies) {
    const words = a.toLowerCase().split(/[^a-z]+/);
    for (const [allergen, list] of Object.entries(ALLERGY_WORDS) as [Allergen, string[]][]) {
      if (words.some((w) => list.includes(w))) out.add(allergen);
    }
  }
  return out;
}

function pickSides(options: Side[], i: FeedbackInput): string[] {
  const blocked = blockedAllergens(i.preferences.allergies);
  const eaten = i.mealItemNames.map((n) => n.toLowerCase());
  return options
    .filter((s) => !s.allergens.some((a) => blocked.has(a)))
    .filter((s) => !eaten.some((n) => n.includes(s.key)))
    .slice(0, 2)
    .map((s) => s.name);
}

function joinOr(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.join(' or ');
}

function isIndian(cuisines: string[]): boolean {
  return cuisines.some((c) => /indian/i.test(c));
}

function level(value: number | null, high: number, some: number, words: [string, string, string]): string | null {
  if (value == null) return null;
  if (value >= high) return words[0];
  if (value >= some) return words[1];
  return words[2];
}

function observationFor(i: FeedbackInput, proteinLeft: number | null): string {
  const protein = i.meal.protein_g;
  if (i.hideNumbers) {
    const p = level(protein, 20, 10, ['plenty of protein', 'some protein', 'a little protein']);
    const f = level(i.meal.fibre_g, 6, 3, ['plenty of fibre', 'some fibre', 'a little fibre']);
    if (p && f) return `This meal has ${p} and ${f}.`;
    if (p) return `This meal has ${p}. Fibre for it is unknown.`;
    if (f) return `This meal has ${f}. Protein for it is unknown.`;
    return 'Protein and fibre for this meal are unknown.';
  }
  const kcal = i.meal.kcal;
  const lead = kcal == null ? 'This meal adds' : `This meal is about ${formatInt(kcal)} kcal and adds`;
  if (protein == null) {
    return kcal == null ? 'Protein and calories for this meal are unknown.' : `This meal is about ${formatInt(kcal)} kcal. Its protein is unknown.`;
  }
  const g = `${formatInt(protein)} g protein`;
  if (proteinLeft == null) return `${lead} ${g}.`;
  if (proteinLeft <= 0) return `${lead} ${g}, which reaches today's protein target.`;
  return `${lead} ${g}, leaving ${formatInt(proteinLeft)} g for today.`;
}

/** One observation and one suggestion after a meal is logged. Never mentions exercise. */
export function postMealFeedback(i: FeedbackInput): Feedback {
  const proteinLeft = i.dayAfter.protein_g == null ? null : i.targets.proteinG - i.dayAfter.protein_g;
  const observation = observationFor(i, proteinLeft);
  const indian = isIndian(i.preferences.cuisines);
  const target = i.targets.calorieTarget;
  const dayKcal = i.dayAfter.kcal;

  if (target != null && dayKcal != null && dayKcal > target) {
    return {
      observation,
      suggestion: i.hideNumbers
        ? 'Today is above the calorie target. Nothing to fix, tomorrow is a fresh day.'
        : `Today is at ${formatInt(dayKcal)} of ${formatInt(target)} kcal. Nothing to fix, tomorrow is a fresh day.`,
      why: null,
    };
  }

  if (proteinLeft != null && proteinLeft > 30) {
    const sides = PROTEIN_SIDES[dietOf(i.preferences.dietPattern)][indian ? 'indian' : 'other'];
    return {
      observation,
      suggestion: `For more protein later today, ${joinOr(pickSides(sides, i), 'a protein-rich side you like')} would fit.`,
      why: 'Spreading protein across meals helps with fullness and keeping muscle.',
    };
  }

  const { fibre_g: fibre, kcal } = i.meal;
  if (fibre != null && kcal != null && kcal > 0 && (fibre / kcal) * 100 < 1.5) {
    const sides = FIBRE_SIDES[indian ? 'indian' : 'other'];
    return {
      observation,
      suggestion: `Next time, ${joinOr(pickSides(sides, i), 'some vegetables or fruit')} on the side would add fibre.`,
      why: 'Fibre adds fullness and supports digestion.',
    };
  }

  if (i.meal.sodium_mg != null && i.meal.sodium_mg > 800) {
    return {
      observation,
      suggestion: 'This meal is on the salty side. Water and lighter-sodium choices later today can balance it out.',
      why: 'Salty meals can cause a short rise in water weight, which settles in a day or two.',
    };
  }

  return { observation, suggestion: 'A nice balance. Nothing to change here.', why: null };
}
