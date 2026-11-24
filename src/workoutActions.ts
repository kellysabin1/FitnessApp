import { findExercise } from './exercises';
import { lastPerformance } from './stats';
import { SetEntry, uid, useStore, WorkoutExercise } from './store';

/** Build a new exercise entry, pre-filled from the last time it was done (progressive overload). */
export function makeExercise(name: string, excludeWorkoutId?: string): WorkoutExercise {
  const def = findExercise(name) ?? { name, category: 'strength' as const, kind: 'weighted' as const, muscle: '' };
  const prev = lastPerformance(useStore.getState().workouts, def.name, excludeWorkoutId);
  const blank = (): SetEntry => ({ done: false });
  const sets: SetEntry[] = prev?.length
    ? prev.map((p) => ({ reps: p.reps, weightKg: p.weightKg, seconds: p.seconds, distanceKm: p.distanceKm, warmup: p.warmup, done: false }))
    : def.category === 'cardio'
      ? [blank()]
      : [blank(), blank(), blank()];
  return { id: uid(), name: def.name, category: def.category, kind: def.kind, sets };
}

export function addExercisesByName(workoutId: string, names: string[]) {
  useStore.getState().updateWorkout(workoutId, (w) => ({
    ...w,
    exercises: [...w.exercises, ...names.map((n) => makeExercise(n, workoutId))],
  }));
}
