import { useStore } from './store';

export type ExerciseCategory = 'strength' | 'pilates' | 'mobility' | 'cardio';
export type ExerciseKind = 'weighted' | 'bodyweight' | 'timed' | 'distance';

export interface ExerciseDef {
  name: string;
  /** created by the user rather than built in */
  custom?: boolean;
  category: ExerciseCategory;
  muscle: string;
  kind: ExerciseKind;
}

const s = (name: string, muscle: string, kind: ExerciseKind = 'weighted'): ExerciseDef => ({
  name, muscle, kind, category: 'strength',
});
const p = (name: string, muscle: string, kind: ExerciseKind = 'bodyweight'): ExerciseDef => ({
  name, muscle, kind, category: 'pilates',
});
const m = (name: string, muscle: string): ExerciseDef => ({ name, muscle, kind: 'timed', category: 'mobility' });
const c = (name: string, kind: ExerciseKind = 'timed'): ExerciseDef => ({ name, muscle: 'Cardio', kind, category: 'cardio' });

export const EXERCISES: ExerciseDef[] = [
  // Glutes & legs
  s('Hip Thrust', 'Glutes'), s('Barbell Back Squat', 'Legs'), s('Goblet Squat', 'Legs'),
  s('Romanian Deadlift', 'Hamstrings'), s('Conventional Deadlift', 'Posterior chain'),
  s('Sumo Deadlift', 'Glutes'), s('Bulgarian Split Squat', 'Glutes'), s('Walking Lunge', 'Legs'),
  s('Reverse Lunge', 'Glutes'), s('Leg Press', 'Legs'), s('Hack Squat', 'Legs'),
  s('Leg Extension', 'Quads'), s('Lying Leg Curl', 'Hamstrings'), s('Seated Leg Curl', 'Hamstrings'),
  s('Cable Kickback', 'Glutes'), s('Hip Abduction Machine', 'Glutes'), s('Step-Up', 'Glutes'),
  s('Glute Bridge', 'Glutes'), s('Kas Glute Bridge', 'Glutes'), s('Standing Calf Raise', 'Calves'),
  s('Frog Pump', 'Glutes', 'bodyweight'), s('Good Morning', 'Hamstrings'),
  // Single-leg / single-arm
  s('Single-Leg Leg Press', 'Legs'), s('Single-Leg Romanian Deadlift', 'Hamstrings'), s('Single-Leg Hip Thrust', 'Glutes'),
  s('Single-Leg Glute Bridge', 'Glutes', 'bodyweight'), s('Single-Leg Leg Extension', 'Quads'), s('Single-Leg Leg Curl', 'Hamstrings'),
  s('Single-Leg Calf Raise', 'Calves'), s('Split Squat', 'Legs'), s('Lateral Lunge', 'Legs'), s('Curtsy Lunge', 'Glutes'),
  s('Cossack Squat', 'Legs'), s('Skater Squat', 'Legs', 'bodyweight'), s('Box Pistol Squat', 'Legs', 'bodyweight'),
  s('Single-Arm Cable Row', 'Back'), s('Single-Arm Lat Pulldown', 'Back'), s('Single-Arm Dumbbell Bench Press', 'Chest'),
  s('Single-Arm Shoulder Press', 'Shoulders'), s('Single-Arm Landmine Press', 'Shoulders'), s('Single-Arm Cable Lateral Raise', 'Shoulders'),
  s('Single-Arm Tricep Extension', 'Triceps'), s('Single-Arm Farmer Carry', 'Core', 'timed'),
  // Upper
  s('Lat Pulldown', 'Back'), s('Seated Cable Row', 'Back'), s('Single-Arm Dumbbell Row', 'Back'),
  s('Assisted Pull-Up', 'Back'), s('Pull-Up', 'Back', 'bodyweight'), s('Face Pull', 'Rear delts'),
  s('Dumbbell Bench Press', 'Chest'), s('Barbell Bench Press', 'Chest'), s('Incline Dumbbell Press', 'Chest'),
  s('Push-Up', 'Chest', 'bodyweight'), s('Overhead Press', 'Shoulders'), s('Arnold Press', 'Shoulders'),
  s('Lateral Raise', 'Shoulders'), s('Rear Delt Fly', 'Rear delts'), s('Bicep Curl', 'Biceps'),
  s('Hammer Curl', 'Biceps'), s('Tricep Rope Pushdown', 'Triceps'), s('Overhead Tricep Extension', 'Triceps'),
  // Core
  s('Cable Crunch', 'Core'), s('Hanging Knee Raise', 'Core', 'bodyweight'), s('Plank', 'Core', 'timed'),
  s('Side Plank', 'Obliques', 'timed'), s('Dead Bug', 'Core', 'bodyweight'), s('Pallof Press', 'Core'),
  // Pilates
  p('The Hundred', 'Core'), p('Roll Up', 'Core'), p('Single Leg Stretch', 'Core'),
  p('Double Leg Stretch', 'Core'), p('Criss Cross', 'Obliques'), p('Teaser', 'Core'),
  p('Swan', 'Back'), p('Swimming', 'Back'), p('Side-Lying Leg Series', 'Glutes'),
  p('Clamshell', 'Glutes'), p('Shoulder Bridge', 'Glutes'), p('Saw', 'Core'),
  p('Reformer Footwork', 'Legs', 'weighted'), p('Reformer Leg Circles', 'Hips', 'weighted'),
  p('Reformer Elephant', 'Core', 'weighted'), p('Reformer Long Stretch', 'Core', 'weighted'),
  // Mobility / yoga
  m('Downward Dog', 'Full body'), m('Pigeon Pose', 'Hips'), m('90/90 Hip Switch', 'Hips'),
  m('World’s Greatest Stretch', 'Full body'), m('Cat-Cow', 'Spine'), m('Couch Stretch', 'Hip flexors'),
  m('Thoracic Rotation', 'Spine'), m('Child’s Pose', 'Back'), m('Yoga Flow', 'Full body'),
  m('Foam Rolling', 'Recovery'),
  // Cardio
  c('Incline Walk'), c('Outdoor Walk', 'distance'), c('Run', 'distance'), c('Zone 2 Cycling'),
  c('Stairmaster'), c('Rowing', 'distance'), c('HIIT Intervals'), c('Elliptical'), c('Dance Cardio'),
];

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  pilates: 'Pilates',
  mobility: 'Mobility & yoga',
  cardio: 'Cardio',
};

/** Built-in exercises plus the ones this person created ("Your exercises"). */
export function allExercises(): ExerciseDef[] {
  const custom = useStore.getState().customExercises ?? [];
  return [...EXERCISES, ...custom.map((c) => ({ ...c, custom: true }))];
}

export function findExercise(name: string): ExerciseDef | undefined {
  const n = name.trim().toLowerCase();
  return allExercises().find((e) => e.name.toLowerCase() === n);
}
