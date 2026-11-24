import { findExercise } from './exercises';
import { lastPerformance } from './stats';
import { type Goal, uid, useStore, type SetEntry, type WorkoutExercise } from './store';
import { firstReps, type PlannedExercise, type Split, type SplitWorkout } from './training';

/** Add planned exercises to a workout: last session's numbers if you've done it, else the planned sets × reps. */
export function addPlannedExercises(workoutId: string, planned: PlannedExercise[]) {
  const all = useStore.getState().workouts;
  const exs: WorkoutExercise[] = planned.map((p) => {
    const def = findExercise(p.name) ?? { name: p.name, category: 'strength' as const, kind: 'weighted' as const, muscle: '' };
    const prev = lastPerformance(all, def.name, workoutId);
    const reps = firstReps(p.reps);
    const sets: SetEntry[] = prev?.length
      ? prev.map((s) => ({
          reps: s.reps,
          weightKg: s.weightKg,
          seconds: s.seconds,
          distanceKm: s.distanceKm,
          warmup: s.warmup,
          done: false,
        }))
      : Array.from({ length: Math.max(1, Math.min(10, p.sets ?? (def.category === 'cardio' ? 1 : 3))) }, () => ({
          reps: def.kind === 'weighted' || def.kind === 'bodyweight' ? reps : undefined,
          done: false,
        }));
    return {
      id: uid(),
      name: def.name,
      category: def.category,
      kind: def.kind,
      sets,
      note: p.sets ? `Target ${p.sets} × ${p.reps ?? ''}`.trim() : undefined,
    };
  });
  useStore.getState().updateWorkout(workoutId, (w) => ({ ...w, exercises: [...w.exercises, ...exs] }));
}

/** Start a workout from a split (counts toward its rolling "up next" order). Returns the workout id. */
export function startSplitWorkout(split: Split, sw: SplitWorkout) {
  const id = useStore.getState().startWorkout(sw.title, undefined, { splitId: split.id, splitWorkoutId: sw.id });
  addPlannedExercises(id, sw.exercises);
  return id;
}

/** Start a one-off planned workout (e.g. from the coach) without saving it anywhere. */
export function startPlannedWorkout(title: string, exercises: PlannedExercise[]) {
  const id = useStore.getState().startWorkout(title);
  addPlannedExercises(id, exercises);
  return id;
}

const COACH_FOLDER = 'From your coach';

/** Save a coach-suggested workout into the "From your coach" folder (created on first use). */
export function saveToCoachFolder(title: string, exercises: PlannedExercise[]) {
  const st = useStore.getState();
  const t = new Date().toISOString();
  const existing = st.splits.find((s) => s.source === 'coach');
  const sw: SplitWorkout = { id: uid(), title, exercises };
  if (existing) {
    if (existing.workouts.some((w) => w.title === title)) return existing.id;
    st.saveSplit({ ...existing, workouts: [...existing.workouts, sw] });
    return existing.id;
  }
  const split: Split = { id: uid(), name: COACH_FOLDER, source: 'coach', workouts: [sw], createdAt: t, updatedAt: t };
  st.saveSplit(split);
  return split.id;
}

export const exerciseLabel = (e: PlannedExercise | string) =>
  typeof e === 'string' ? e : `${e.name}${e.sets ? ` ${e.sets}×${e.reps ?? ''}` : ''}`;

/** Older coach plans stored exercises as text like "Hip Thrust 4×8 @ 160 lb" — turn them into planned exercises. */
export function toPlanned(e: PlannedExercise | string): PlannedExercise {
  if (typeof e !== 'string') return e;
  const m = e.match(/^(.*?)\s+(\d+)\s*[×x]\s*([\w–-]+)/);
  return m ? { name: m[1].trim(), sets: parseInt(m[2], 10), reps: m[3] } : { name: e.trim() };
}

// ── Ready-made splits ──

const ex = (name: string, sets: number, reps: string): PlannedExercise => ({ name, sets, reps });
const w = (title: string, focus: string, exercises: PlannedExercise[]) => ({ title, focus, exercises });

export interface StarterSplit {
  name: string;
  days: number;
  blurb: string;
  goals: Goal[];
  workouts: { title: string; focus: string; exercises: PlannedExercise[] }[];
}

export const STARTER_SPLITS: StarterSplit[] = [
  {
    name: 'Full body · 3 days',
    days: 3,
    blurb: 'Three balanced sessions. Great for building a habit or getting stronger on limited time.',
    goals: ['consistency', 'build_strength', 'lose_fat'],
    workouts: [
      w('Full body A', 'Squat + push focus', [
        ex('Goblet Squat', 3, '8-10'),
        ex('Dumbbell Bench Press', 3, '8-10'),
        ex('Romanian Deadlift', 3, '10'),
        ex('Seated Cable Row', 3, '10-12'),
        ex('Plank', 3, '30s'),
      ]),
      w('Full body B', 'Hinge + pull focus', [
        ex('Hip Thrust', 3, '8-10'),
        ex('Lat Pulldown', 3, '10-12'),
        ex('Reverse Lunge', 3, '10 each side'),
        ex('Overhead Press', 3, '8-10'),
        ex('Dead Bug', 3, '10'),
      ]),
      w('Full body C', 'Single-leg + conditioning', [
        ex('Bulgarian Split Squat', 3, '8 each side'),
        ex('Single-Arm Dumbbell Row', 3, '10'),
        ex('Single-Leg Romanian Deadlift', 3, '8 each side'),
        ex('Push-Up', 3, '10-15'),
        ex('Incline Walk', 1, '15 min'),
      ]),
    ],
  },
  {
    name: 'Upper / lower · 4 days',
    days: 4,
    blurb: 'Two lower and two upper days. A classic for strength and building muscle.',
    goals: ['build_strength', 'grow_glutes', 'recomp'],
    workouts: [
      w('Lower A', 'Strength: squat pattern', [
        ex('Barbell Back Squat', 4, '5-6'),
        ex('Romanian Deadlift', 3, '8'),
        ex('Single-Leg Leg Press', 3, '10 each side'),
        ex('Lying Leg Curl', 3, '10-12'),
        ex('Standing Calf Raise', 3, '12'),
      ]),
      w('Upper A', 'Strength: press + row', [
        ex('Barbell Bench Press', 4, '5-6'),
        ex('Seated Cable Row', 3, '8-10'),
        ex('Overhead Press', 3, '8'),
        ex('Lat Pulldown', 3, '10'),
        ex('Bicep Curl', 2, '12'),
      ]),
      w('Lower B', 'Hypertrophy: hinge + glutes', [
        ex('Hip Thrust', 4, '8-10'),
        ex('Bulgarian Split Squat', 3, '10 each side'),
        ex('Leg Extension', 3, '12'),
        ex('Cable Kickback', 3, '12 each side'),
        ex('Hanging Knee Raise', 3, '12'),
      ]),
      w('Upper B', 'Hypertrophy: pull + shoulders', [
        ex('Assisted Pull-Up', 3, '8'),
        ex('Incline Dumbbell Press', 3, '10'),
        ex('Single-Arm Cable Row', 3, '12 each side'),
        ex('Lateral Raise', 3, '15'),
        ex('Tricep Rope Pushdown', 3, '12'),
      ]),
    ],
  },
  {
    name: 'Push / pull / legs · 3 days',
    days: 3,
    blurb: 'Each session trains one movement family. Run it once or twice a week.',
    goals: ['build_strength', 'recomp'],
    workouts: [
      w('Push', 'Chest, shoulders, triceps', [
        ex('Barbell Bench Press', 4, '6-8'),
        ex('Overhead Press', 3, '8'),
        ex('Incline Dumbbell Press', 3, '10'),
        ex('Lateral Raise', 3, '15'),
        ex('Tricep Rope Pushdown', 3, '12'),
      ]),
      w('Pull', 'Back, rear delts, biceps', [
        ex('Lat Pulldown', 4, '8-10'),
        ex('Seated Cable Row', 3, '10'),
        ex('Face Pull', 3, '15'),
        ex('Hammer Curl', 3, '12'),
        ex('Rear Delt Fly', 3, '15'),
      ]),
      w('Legs', 'Quads, hamstrings, glutes', [
        ex('Barbell Back Squat', 4, '6-8'),
        ex('Romanian Deadlift', 3, '8-10'),
        ex('Leg Press', 3, '12'),
        ex('Lying Leg Curl', 3, '12'),
        ex('Standing Calf Raise', 3, '15'),
      ]),
    ],
  },
  {
    name: 'Strength + Pilates · 4 days',
    days: 4,
    blurb: 'Two lifting days, one Pilates day, one mobility day. Strong and mobile.',
    goals: ['flexibility', 'build_strength', 'grow_glutes'],
    workouts: [
      w('Lower body', 'Glutes and legs', [
        ex('Hip Thrust', 4, '8-10'),
        ex('Goblet Squat', 3, '10'),
        ex('Single-Leg Romanian Deadlift', 3, '8 each side'),
        ex('Hip Abduction Machine', 3, '15'),
      ]),
      w('Mat Pilates', 'Core and control', [
        ex('The Hundred', 1, '100'),
        ex('Roll Up', 2, '8'),
        ex('Single Leg Stretch', 2, '10'),
        ex('Criss Cross', 2, '10'),
        ex('Swan', 2, '6'),
      ]),
      w('Upper body', 'Back, shoulders, arms', [
        ex('Lat Pulldown', 3, '10'),
        ex('Dumbbell Bench Press', 3, '10'),
        ex('Single-Arm Shoulder Press', 3, '10 each side'),
        ex('Face Pull', 3, '15'),
      ]),
      w('Mobility reset', 'Recovery and range of motion', [
        ex('Cat-Cow', 1, '1 min'),
        ex('World’s Greatest Stretch', 2, '5 each side'),
        ex('90/90 Hip Switch', 2, '8'),
        ex('Pigeon Pose', 2, '45s each side'),
        ex('Foam Rolling', 1, '5 min'),
      ]),
    ],
  },
  {
    name: 'Cardio base · 3 days',
    days: 3,
    blurb: 'Build endurance with Zone 2, intervals and a longer session.',
    goals: ['endurance', 'lose_fat'],
    workouts: [
      w('Zone 2', 'Easy, conversational pace', [ex('Zone 2 Cycling', 1, '35 min'), ex('Plank', 3, '30s')]),
      w('Intervals', 'Short, hard efforts', [ex('HIIT Intervals', 1, '20 min'), ex('Dead Bug', 3, '10')]),
      w('Long session', 'Steady and long', [ex('Run', 1, '30-45 min'), ex('Couch Stretch', 2, '45s each side')]),
    ],
  },
];

export function makeSplitFromStarter(s: StarterSplit): Split {
  const t = new Date().toISOString();
  return {
    id: uid(),
    name: s.name,
    notes: `${s.blurb} Rolling order: if you miss a day, just do the next workout.`,
    source: 'template',
    workouts: s.workouts.map((x) => ({ id: uid(), ...x })),
    createdAt: t,
    updatedAt: t,
  };
}

/** Sort ready-made items so the ones matching your goals come first. */
export function byGoals<T extends { goals?: Goal[] }>(items: T[], goals: Goal[]) {
  const score = (x: T) => (x.goals ?? []).filter((g) => goals.includes(g)).length;
  return [...items].sort((a, b) => score(b) - score(a));
}
