import { useStore } from '../store';
import { syncUp } from './api';

const WATCHED = [
  'workouts',
  'body',
  'profile',
  'units',
  'customExercises',
  'splits',
  'activeSplitId',
  'targets',
  'health',
  'pendingDeletes',
  'pendingBodyDeletes',
] as const;
const DELAY_MS = 4000;

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/**
 * Back up changes to the account a few seconds after they happen (batched), while signed in.
 * Failures are fine — the next change or app start retries everything since the last good sync.
 */
export function startAutoSync() {
  if (started) return;
  started = true;
  useStore.subscribe((state, prev) => {
    if (!state.account?.username) return;
    const justSignedIn = !prev.account?.username; // finished sign-in / account setup → back up everything
    if (!justSignedIn && !WATCHED.some((k) => state[k] !== prev[k])) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      syncUp().catch(() => {});
    }, DELAY_MS);
  });
}
