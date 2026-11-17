import { useStore } from '../store';
import { shareFinishedWorkout, syncUp } from './api';
import { notifyActivity } from './push';

/**
 * Call after a workout is finished or a past workout is saved:
 * backs it up, posts it to running challenges and pings friends. Never throws.
 */
export async function afterWorkoutSaved(workoutId: string, opts: { announce: boolean }) {
  const s = useStore.getState();
  if (!s.account?.username) return;
  const w = s.workouts.find((x) => x.id === workoutId);
  if (!w?.finishedAt) return;
  try {
    if (!opts.announce) {
      await syncUp();
      return;
    }
    const ids = await shareFinishedWorkout(w);
    await notifyActivity(ids);
  } catch {
    // offline etc. — the next sync picks it up
  }
}
