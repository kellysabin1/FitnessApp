import type { BodyEntry, Workout } from './store';
import { todayKey } from './store';

export const epley1RM = (weightKg: number, reps: number) =>
  reps <= 1 ? weightKg : weightKg * (1 + reps / 30);

export function finished(workouts: Workout[]) {
  return workouts.filter((w) => w.finishedAt);
}

export function workoutVolumeKg(w: Workout) {
  let v = 0;
  for (const ex of w.exercises)
    for (const s of ex.sets) if (s.done && s.reps && s.weightKg) v += s.reps * s.weightKg;
  return v;
}

export function workoutDurationMin(w: Workout) {
  if (!w.finishedAt) return 0;
  return Math.max(1, Math.round((+new Date(w.finishedAt) - +new Date(w.startedAt)) / 60000));
}

export function setsDone(w: Workout) {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
}

/** Best estimated 1RM per exercise, plus the set it came from. */
export function personalRecords(workouts: Workout[]) {
  const prs = new Map<string, { e1rm: number; weightKg: number; reps: number; date: string }>();
  for (const w of finished(workouts)) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (!s.done || !s.weightKg || !s.reps) continue;
        const e = epley1RM(s.weightKg, s.reps);
        const cur = prs.get(ex.name);
        if (!cur || e > cur.e1rm) prs.set(ex.name, { e1rm: e, weightKg: s.weightKg, reps: s.reps, date: w.startedAt });
      }
    }
  }
  return [...prs.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Last time an exercise was performed — used to prefill sets (progressive overload). */
export function lastPerformance(workouts: Workout[], name: string, excludeId?: string) {
  for (const w of finished(workouts)) {
    if (w.id === excludeId) continue;
    const ex = w.exercises.find((e) => e.name === name);
    if (ex && ex.sets.some((s) => s.done)) return ex.sets.filter((s) => s.done);
  }
  return undefined;
}

export function workoutsThisWeek(workouts: Workout[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  start.setHours(0, 0, 0, 0);
  return finished(workouts).filter((w) => new Date(w.startedAt) >= start).length;
}

/** Consecutive weeks (including this one) with at least one finished workout. */
export function weekStreak(workouts: Workout[]) {
  const weeks = new Set(finished(workouts).map((w) => weekKey(new Date(w.startedAt))));
  let streak = 0;
  const d = new Date();
  if (!weeks.has(weekKey(d))) d.setDate(d.getDate() - 7); // this week not started yet is fine
  while (weeks.has(weekKey(d))) {
    streak++;
    d.setDate(d.getDate() - 7);
  }
  return streak;
}

function weekKey(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return todayKey(x);
}

export function latestBody(body: BodyEntry[], field: keyof BodyEntry) {
  for (let i = body.length - 1; i >= 0; i--) if (body[i][field] != null) return body[i];
  return undefined;
}

export function weightSeries(body: BodyEntry[], days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const ck = todayKey(cutoff);
  return body.filter((b) => b.weightKg != null && b.date >= ck).map((b) => ({ date: b.date, value: b.weightKg! }));
}

export function lastNDates(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(todayKey(x));
  }
  return out;
}

export function relativeDay(iso: string) {
  const d = new Date(iso);
  const today = todayKey();
  const k = todayKey(d);
  if (k === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (k === todayKey(y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
