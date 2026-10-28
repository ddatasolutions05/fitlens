// Built-in workouts. Each one maps to a workout type and intensity so a
// completed session gets the same MET-based estimate as a manual log.
import type { Intensity, WorkoutType } from '../activity';

export type Equipment = 'bodyweight' | 'dumbbells' | 'barbell' | 'machines' | 'bands' | 'kettlebell';
export type Focus = 'general' | 'strength' | 'fat_loss' | 'endurance' | 'mobility';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Pattern = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'core' | 'cardio' | 'intervals' | 'mobility';

export interface Exercise {
  name: string;
  sets: number;
  /** "8 to 12", "30 s", "400 m". */
  dose: string;
  restSec: number;
  cue?: string;
}

export interface Workout {
  id: string;
  name: string;
  pattern: Pattern;
  focus: Focus[];
  level: Level;
  /** Any one of these is enough. */
  equipment: Equipment[];
  minutes: number;
  type: WorkoutType;
  intensity: Intensity;
  summary: string;
  exercises: Exercise[];
}

export const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'bodyweight', label: 'Bodyweight only' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'bands', label: 'Resistance bands' },
  { key: 'barbell', label: 'Barbell and rack' },
  { key: 'machines', label: 'Gym machines' },
];

export const FOCUS_OPTIONS: { key: Focus; label: string; hint: string }[] = [
  { key: 'general', label: 'General fitness', hint: 'Strength, cardio and mobility in balance' },
  { key: 'strength', label: 'Build strength', hint: 'Heavier lifts, longer rests' },
  { key: 'fat_loss', label: 'Fat loss', hint: 'Full-body work and intervals, higher calorie burn' },
  { key: 'endurance', label: 'Endurance', hint: 'More cardio, steady and interval' },
  { key: 'mobility', label: 'Move better', hint: 'Mobility and easy strength' },
];

export const LEVELS: { key: Level; label: string; hint: string }[] = [
  { key: 'beginner', label: 'Beginner', hint: 'New or returning after a break' },
  { key: 'intermediate', label: 'Intermediate', hint: 'Training regularly for 6+ months' },
  { key: 'advanced', label: 'Advanced', hint: 'Years of consistent training' },
];

const W = (w: Workout): Workout => w;

export const WORKOUTS: readonly Workout[] = [
  W({
    id: 'bw-full-a',
    name: 'Full body, no equipment',
    pattern: 'full',
    focus: ['general', 'fat_loss', 'strength'],
    level: 'beginner',
    equipment: ['bodyweight'],
    minutes: 30,
    type: 'strength',
    intensity: 'moderate',
    summary: 'Squats, push-ups, hinges and a plank. Three rounds, steady pace.',
    exercises: [
      { name: 'Bodyweight squat', sets: 3, dose: '12 to 15', restSec: 60, cue: 'Sit back, knees over toes, full depth you control.' },
      { name: 'Push-up (knees if needed)', sets: 3, dose: '8 to 12', restSec: 60, cue: 'Body in one line, elbows at 45 degrees.' },
      { name: 'Glute bridge', sets: 3, dose: '15', restSec: 45 },
      { name: 'Reverse lunge', sets: 3, dose: '10 each side', restSec: 60 },
      { name: 'Plank', sets: 3, dose: '30 to 45 s', restSec: 45 },
    ],
  }),
  W({
    id: 'bw-full-b',
    name: 'Full body, no equipment B',
    pattern: 'full',
    focus: ['general', 'fat_loss'],
    level: 'intermediate',
    equipment: ['bodyweight'],
    minutes: 35,
    type: 'strength',
    intensity: 'vigorous',
    summary: 'Split squats, pike push-ups and a circuit finish.',
    exercises: [
      { name: 'Bulgarian split squat', sets: 3, dose: '8 to 10 each side', restSec: 75 },
      { name: 'Pike push-up', sets: 3, dose: '6 to 10', restSec: 75 },
      { name: 'Single-leg hip hinge', sets: 3, dose: '10 each side', restSec: 60 },
      { name: 'Inverted row (table or bar)', sets: 3, dose: '8 to 12', restSec: 60 },
      { name: 'Circuit: squat jump, mountain climber, hollow hold', sets: 3, dose: '40 s each', restSec: 60 },
    ],
  }),
  W({
    id: 'db-upper',
    name: 'Upper body, dumbbells',
    pattern: 'upper',
    focus: ['strength', 'general'],
    level: 'beginner',
    equipment: ['dumbbells', 'kettlebell'],
    minutes: 40,
    type: 'strength',
    intensity: 'moderate',
    summary: 'Press, row, overhead press, curls and triceps. Leave two reps in reserve.',
    exercises: [
      { name: 'Dumbbell floor or bench press', sets: 3, dose: '8 to 12', restSec: 90 },
      { name: 'One-arm dumbbell row', sets: 3, dose: '10 to 12 each side', restSec: 75 },
      { name: 'Seated overhead press', sets: 3, dose: '8 to 12', restSec: 90 },
      { name: 'Hammer curl', sets: 2, dose: '12', restSec: 60 },
      { name: 'Overhead triceps extension', sets: 2, dose: '12', restSec: 60 },
    ],
  }),
  W({
    id: 'db-lower',
    name: 'Lower body, dumbbells',
    pattern: 'lower',
    focus: ['strength', 'general', 'fat_loss'],
    level: 'beginner',
    equipment: ['dumbbells', 'kettlebell'],
    minutes: 40,
    type: 'strength',
    intensity: 'moderate',
    summary: 'Goblet squats, Romanian deadlifts, lunges and calves.',
    exercises: [
      { name: 'Goblet squat', sets: 4, dose: '10 to 12', restSec: 90, cue: 'Elbows inside the knees at the bottom.' },
      { name: 'Dumbbell Romanian deadlift', sets: 3, dose: '10 to 12', restSec: 90, cue: 'Hips back, shins vertical, flat back.' },
      { name: 'Walking lunge', sets: 3, dose: '10 each side', restSec: 75 },
      { name: 'Standing calf raise', sets: 3, dose: '15 to 20', restSec: 45 },
      { name: 'Dead bug', sets: 3, dose: '10 each side', restSec: 45 },
    ],
  }),
  W({
    id: 'bb-push',
    name: 'Push day, barbell',
    pattern: 'push',
    focus: ['strength'],
    level: 'intermediate',
    equipment: ['barbell', 'machines'],
    minutes: 50,
    type: 'strength',
    intensity: 'moderate',
    summary: 'Bench, overhead press, incline work and triceps.',
    exercises: [
      { name: 'Barbell bench press', sets: 4, dose: '5 to 8', restSec: 150 },
      { name: 'Overhead press', sets: 3, dose: '6 to 8', restSec: 120 },
      { name: 'Incline dumbbell or machine press', sets: 3, dose: '10 to 12', restSec: 90 },
      { name: 'Lateral raise', sets: 3, dose: '12 to 15', restSec: 60 },
      { name: 'Cable or rope pushdown', sets: 3, dose: '12', restSec: 60 },
    ],
  }),
  W({
    id: 'bb-pull',
    name: 'Pull day, barbell',
    pattern: 'pull',
    focus: ['strength'],
    level: 'intermediate',
    equipment: ['barbell', 'machines'],
    minutes: 50,
    type: 'strength',
    intensity: 'moderate',
    summary: 'Deadlift or row, pulldowns, face pulls and curls.',
    exercises: [
      { name: 'Deadlift or barbell row', sets: 4, dose: '5 to 6', restSec: 180 },
      { name: 'Lat pulldown or pull-up', sets: 3, dose: '8 to 10', restSec: 120 },
      { name: 'Seated cable row', sets: 3, dose: '10 to 12', restSec: 90 },
      { name: 'Face pull', sets: 3, dose: '15', restSec: 60 },
      { name: 'Barbell or dumbbell curl', sets: 3, dose: '10 to 12', restSec: 60 },
    ],
  }),
  W({
    id: 'bb-legs',
    name: 'Leg day, barbell',
    pattern: 'lower',
    focus: ['strength', 'fat_loss'],
    level: 'intermediate',
    equipment: ['barbell', 'machines'],
    minutes: 55,
    type: 'strength',
    intensity: 'vigorous',
    summary: 'Squat, Romanian deadlift, leg press and hamstrings.',
    exercises: [
      { name: 'Back squat', sets: 4, dose: '5 to 8', restSec: 180 },
      { name: 'Romanian deadlift', sets: 3, dose: '8 to 10', restSec: 120 },
      { name: 'Leg press or split squat', sets: 3, dose: '10 to 12', restSec: 90 },
      { name: 'Leg curl', sets: 3, dose: '12', restSec: 60 },
      { name: 'Standing calf raise', sets: 4, dose: '12 to 15', restSec: 45 },
    ],
  }),
  W({
    id: 'machine-full',
    name: 'Full body on machines',
    pattern: 'full',
    focus: ['general', 'strength', 'fat_loss'],
    level: 'beginner',
    equipment: ['machines'],
    minutes: 40,
    type: 'strength',
    intensity: 'moderate',
    summary: 'A simple circuit of the main machines, easy to learn.',
    exercises: [
      { name: 'Leg press', sets: 3, dose: '12', restSec: 75 },
      { name: 'Chest press', sets: 3, dose: '12', restSec: 75 },
      { name: 'Seated row', sets: 3, dose: '12', restSec: 75 },
      { name: 'Leg curl', sets: 2, dose: '12', restSec: 60 },
      { name: 'Shoulder press', sets: 2, dose: '12', restSec: 60 },
      { name: 'Cable crunch or plank', sets: 2, dose: '15 or 40 s', restSec: 45 },
    ],
  }),
  W({
    id: 'kb-circuit',
    name: 'Kettlebell circuit',
    pattern: 'full',
    focus: ['fat_loss', 'general', 'endurance'],
    level: 'intermediate',
    equipment: ['kettlebell'],
    minutes: 30,
    type: 'strength',
    intensity: 'vigorous',
    summary: 'Swings, goblet squats and presses in rounds with short rests.',
    exercises: [
      { name: 'Kettlebell swing', sets: 5, dose: '15', restSec: 45, cue: 'Hinge, snap the hips, arms stay relaxed.' },
      { name: 'Goblet squat', sets: 5, dose: '10', restSec: 45 },
      { name: 'One-arm press', sets: 5, dose: '6 each side', restSec: 45 },
      { name: 'Farmer carry', sets: 5, dose: '30 s', restSec: 60 },
    ],
  }),
  W({
    id: 'band-upper',
    name: 'Upper body with bands',
    pattern: 'upper',
    focus: ['general', 'mobility'],
    level: 'beginner',
    equipment: ['bands'],
    minutes: 30,
    type: 'strength',
    intensity: 'light',
    summary: 'Rows, presses and pull-aparts you can do anywhere.',
    exercises: [
      { name: 'Band row', sets: 3, dose: '15', restSec: 45 },
      { name: 'Band chest press', sets: 3, dose: '12 to 15', restSec: 45 },
      { name: 'Band pull-apart', sets: 3, dose: '15 to 20', restSec: 30 },
      { name: 'Band overhead press', sets: 3, dose: '12', restSec: 45 },
      { name: 'Band curl', sets: 2, dose: '15', restSec: 30 },
    ],
  }),
  W({
    id: 'band-lower',
    name: 'Lower body with bands',
    pattern: 'lower',
    focus: ['general', 'fat_loss', 'mobility'],
    level: 'beginner',
    equipment: ['bands'],
    minutes: 30,
    type: 'strength',
    intensity: 'moderate',
    summary: 'Banded squats, hinges, glute work and calves.',
    exercises: [
      { name: 'Banded squat', sets: 3, dose: '15', restSec: 45 },
      { name: 'Banded Romanian deadlift', sets: 3, dose: '12 to 15', restSec: 45 },
      { name: 'Lateral band walk', sets: 3, dose: '12 each way', restSec: 30 },
      { name: 'Banded glute bridge', sets: 3, dose: '15', restSec: 45 },
      { name: 'Calf raise', sets: 2, dose: '20', restSec: 30 },
    ],
  }),
  W({
    id: 'core-15',
    name: 'Core in 15 minutes',
    pattern: 'core',
    focus: ['general', 'mobility', 'fat_loss'],
    level: 'beginner',
    equipment: ['bodyweight'],
    minutes: 15,
    type: 'strength',
    intensity: 'light',
    summary: 'Planks, dead bugs and bird dogs. Quality over speed.',
    exercises: [
      { name: 'Front plank', sets: 3, dose: '30 to 45 s', restSec: 30 },
      { name: 'Side plank', sets: 2, dose: '20 to 30 s each side', restSec: 30 },
      { name: 'Dead bug', sets: 3, dose: '10 each side', restSec: 30 },
      { name: 'Bird dog', sets: 3, dose: '8 each side', restSec: 30 },
    ],
  }),
  W({
    id: 'walk-brisk',
    name: 'Brisk walk',
    pattern: 'cardio',
    focus: ['general', 'fat_loss', 'endurance', 'mobility'],
    level: 'beginner',
    equipment: ['bodyweight'],
    minutes: 40,
    type: 'walking',
    intensity: 'moderate',
    summary: 'Walk fast enough that talking takes a little effort.',
    exercises: [{ name: 'Walk at a brisk pace', sets: 1, dose: '40 min', restSec: 0, cue: 'Arms swinging, posture tall, steady breathing.' }],
  }),
  W({
    id: 'run-easy',
    name: 'Easy run',
    pattern: 'cardio',
    focus: ['endurance', 'fat_loss', 'general'],
    level: 'intermediate',
    equipment: ['bodyweight'],
    minutes: 30,
    type: 'running',
    intensity: 'light',
    summary: 'A conversational pace. Walk breaks are fine.',
    exercises: [{ name: 'Run at an easy pace', sets: 1, dose: '30 min', restSec: 0 }],
  }),
  W({
    id: 'intervals-20',
    name: 'Intervals, 20 minutes',
    pattern: 'intervals',
    focus: ['fat_loss', 'endurance'],
    level: 'intermediate',
    equipment: ['bodyweight', 'machines'],
    minutes: 20,
    type: 'running',
    intensity: 'vigorous',
    summary: 'Bike, rower or run: 1 minute hard, 2 minutes easy, 6 rounds.',
    exercises: [
      { name: 'Warm up easy', sets: 1, dose: '3 min', restSec: 0 },
      { name: 'Hard effort', sets: 6, dose: '60 s', restSec: 120, cue: 'Hard means you could not hold a sentence.' },
      { name: 'Cool down easy', sets: 1, dose: '3 min', restSec: 0 },
    ],
  }),
  W({
    id: 'cycle-steady',
    name: 'Steady bike ride',
    pattern: 'cardio',
    focus: ['endurance', 'general', 'fat_loss'],
    level: 'beginner',
    equipment: ['bodyweight', 'machines'],
    minutes: 45,
    type: 'cycling',
    intensity: 'moderate',
    summary: 'Indoor or outdoor, a pace you can hold for the whole ride.',
    exercises: [{ name: 'Ride at a steady pace', sets: 1, dose: '45 min', restSec: 0 }],
  }),
  W({
    id: 'mobility-20',
    name: 'Mobility flow',
    pattern: 'mobility',
    focus: ['mobility', 'general'],
    level: 'beginner',
    equipment: ['bodyweight'],
    minutes: 20,
    type: 'yoga',
    intensity: 'light',
    summary: 'Hips, thoracic spine, ankles and shoulders. Breathe through each hold.',
    exercises: [
      { name: 'Cat-cow', sets: 1, dose: '10 slow reps', restSec: 0 },
      { name: 'World’s greatest stretch', sets: 1, dose: '5 each side', restSec: 0 },
      { name: '90/90 hip switch', sets: 1, dose: '10 each side', restSec: 0 },
      { name: 'Deep squat hold', sets: 3, dose: '30 s', restSec: 30 },
      { name: 'Thread the needle', sets: 1, dose: '8 each side', restSec: 0 },
      { name: 'Wall shoulder slide', sets: 2, dose: '10', restSec: 30 },
    ],
  }),
];

export function workoutById(id: string): Workout | null {
  return WORKOUTS.find((w) => w.id === id) ?? null;
}

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Workouts a person can do with what they have, at or below their level. */
export function availableWorkouts(i: { equipment: Equipment[]; level: Level }): Workout[] {
  const have = new Set<Equipment>(['bodyweight', ...i.equipment]);
  return WORKOUTS.filter((w) => LEVEL_RANK[w.level] <= LEVEL_RANK[i.level] && w.equipment.some((e) => have.has(e)));
}
