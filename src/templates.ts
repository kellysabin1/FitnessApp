import type { Tone } from './components/ui';
import type { Goal } from './store';

export type Template = { title: string; tone: Tone; exercises: string[]; goals?: Goal[] };

// Quick-start templates covering strength, pilates, mobility and cardio.
export const TEMPLATES: Template[] = [
  {
    title: 'Glutes & hamstrings',
    tone: 'croc',
    exercises: ['Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Cable Kickback', 'Hip Abduction Machine'],
    goals: ['grow_glutes', 'build_strength', 'recomp'],
  },
  {
    title: 'Upper body',
    tone: 'stripe',
    exercises: ['Lat Pulldown', 'Dumbbell Bench Press', 'Seated Cable Row', 'Lateral Raise', 'Bicep Curl', 'Tricep Rope Pushdown'],
    goals: ['build_strength', 'recomp'],
  },
  {
    title: 'Quads & core',
    tone: 'mocha',
    exercises: ['Goblet Squat', 'Leg Press', 'Walking Lunge', 'Leg Extension', 'Dead Bug', 'Plank'],
    goals: ['grow_glutes', 'build_strength'],
  },
  {
    title: 'Mat Pilates',
    tone: 'tortoise',
    exercises: ['The Hundred', 'Roll Up', 'Single Leg Stretch', 'Criss Cross', 'Side-Lying Leg Series', 'Swan'],
    goals: ['flexibility', 'consistency'],
  },
  {
    title: 'Mobility reset',
    tone: 'satin',
    exercises: ['Cat-Cow', 'World’s Greatest Stretch', '90/90 Hip Switch', 'Pigeon Pose', 'Thoracic Rotation'],
    goals: ['flexibility'],
  },
  {
    title: 'Zone 2 + walk',
    tone: 'stripe',
    exercises: ['Incline Walk', 'Zone 2 Cycling'],
    goals: ['endurance', 'lose_fat', 'consistency'],
  },
];
