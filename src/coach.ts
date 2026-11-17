import { serverPost } from './api';
import { CATEGORY_LABEL } from './exercises';
import {
  personalRecords,
  finished,
  lastNDates,
  setsDone,
  workoutDurationMin,
  latestBody,
} from './stats';
import type { CoachPlan } from './store';
import { uid } from './store';
import { allExercises } from './exercises';
import { describeTarget, type PlannedExercise, type Split, type Target, TARGET_KIND_LABEL, type TargetPlan, targetsForCoach, upNext } from './training';
import { GOAL_LABEL, healthForDate, todayKey, useStore } from './store';
import { displayHeight, displayWeight, weightLabel } from './units';

/**
 * A compact, human-readable snapshot of the user that the AI coach reads.
 * Kept as plain text so it's cheap and easy for the model to use.
 */
export function buildCoachContext(): string {
  const s = useStore.getState();
  const u = s.units;
  const p = s.profile;
  const wl = weightLabel(u);
  const lines: string[] = [];

  lines.push(`Today: ${todayKey()} (${new Date().toLocaleDateString(undefined, { weekday: 'long' })})`);
  lines.push(`Units: ${u === 'us' ? 'US (lb, ft/in)' : 'metric (kg, cm)'} — answer in these units.`);
  lines.push('## Profile');
  lines.push(`Name: ${p.name || 'unknown'}`);
  if (p.sex) lines.push(`Sex: ${p.sex}`);
  if (p.birthYear) lines.push(`Age: ~${new Date().getFullYear() - p.birthYear}`);
  if (p.heightCm) lines.push(`Height: ${displayHeight(p.heightCm, u)}`);
  const w = latestBody(s.body, 'weightKg');
  if (w) lines.push(`Current weight: ${displayWeight(w.weightKg, u)} ${wl} (as of ${w.date})`);
  if (p.goalWeightKg) lines.push(`Goal weight: ${displayWeight(p.goalWeightKg, u)} ${wl}`);
  const bf = latestBody(s.body, 'bodyFatPct');
  if (bf) lines.push(`Body fat: ${bf.bodyFatPct}%`);
  lines.push(`Goals: ${p.goals.map((g) => GOAL_LABEL[g]).join(', ') || 'not set'}`);
  lines.push(`Experience: ${p.experience}; wants to train ${p.daysPerWeek} days/week`);
  lines.push(`Current step goal: ${p.stepGoal}`);
  lines.push(`Equipment: ${p.equipment || 'unknown'}`);
  if (p.notes) lines.push(`Notes/injuries/preferences: ${p.notes}`);

  // Weight trend
  const weights = s.body.filter((b) => b.weightKg != null).slice(-8);
  if (weights.length > 1)
    lines.push(`Recent weigh-ins: ${weights.map((b) => `${b.date} ${displayWeight(b.weightKg, u)}`).join('; ')}`);

  // Health (last 7 days)
  lines.push('## Wearable data, last 7 days (Apple Health incl. RingConn, and Oura)');
  for (const d of lastNDates(7)) {
    const h = healthForDate(s.health, d);
    const parts = [
      h.steps != null && `steps ${h.steps}`,
      h.sleepHours != null && `sleep ${h.sleepHours}h`,
      h.sleepScore != null && `sleep score ${h.sleepScore}`,
      h.readiness != null && `readiness ${h.readiness}`,
      h.restingHr != null && `RHR ${h.restingHr}`,
      h.hrvMs != null && `HRV ${h.hrvMs}ms`,
      h.activeKcal != null && `active ${h.activeKcal}kcal`,
    ].filter(Boolean);
    if (parts.length) lines.push(`${d}: ${parts.join(', ')}`);
  }

  // Training history
  const recent = finished(s.workouts).slice(0, 12);
  lines.push(`## Last ${recent.length} workouts`);
  for (const wk of recent) {
    const exs = wk.exercises
      .map((ex) => {
        const done = ex.sets.filter((x) => x.done && !x.warmup); // warm-ups left out
        if (!done.length) return null;
        const best = done
          .map((x) =>
            x.weightKg
              ? `${displayWeight(x.weightKg, u)}${wl}×${x.reps ?? '?'}`
              : x.reps
                ? `${x.reps} reps`
                : x.seconds
                  ? `${x.seconds}s`
                  : x.distanceKm
                    ? `${x.distanceKm}km`
                    : '',
          )
          .join(', ');
        return `${ex.name} [${CATEGORY_LABEL[ex.category]}] ${best}`;
      })
      .filter(Boolean);
    lines.push(
      `- ${wk.startedAt.slice(0, 10)} "${wk.title}" ${workoutDurationMin(wk)}min, ${setsDone(wk)} sets${wk.mood ? `, felt ${wk.mood}/5` : ''}: ${exs.join(' | ')}`,
    );
  }

  const ctx = { workouts: s.workouts, body: s.body, health: s.health };
  const targetsText = targetsForCoach(s.targets ?? [], ctx, u);
  lines.push('## Active targets');
  lines.push(targetsText || 'None set yet.');
  const split = s.splits?.find((x) => x.id === s.activeSplitId);
  if (split) {
    const nxt = upNext(split, s.workouts);
    lines.push(`## Current split: ${split.name} (rolling order)`);
    split.workouts.forEach((w, i) =>
      lines.push(`${i + 1}. ${w.title}: ${w.exercises.map((e) => `${e.name}${e.sets ? ` ${e.sets}×${e.reps ?? ''}` : ''}`).join(', ')}`),
    );
    if (nxt) lines.push(`Up next: ${nxt.workout.title}`);
  }

  const prs = personalRecords(s.workouts).slice(0, 10);
  if (prs.length) {
    lines.push('## Estimated 1RMs');
    for (const pr of prs) lines.push(`${pr.name}: ~${displayWeight(pr.e1rm, u, 0)} ${wl}`);
  }
  return lines.join('\n');
}

export async function askCoach(message: string): Promise<string> {
  const s = useStore.getState();
  const history = s.coach.slice(-20).map((m) => ({ role: m.role, content: m.text }));
  const { reply } = await serverPost<{ reply: string }>('/coach/chat', {
    context: buildCoachContext(),
    history,
    message,
  });
  return reply;
}

const library = () => allExercises().map((e) => e.name);

export async function generatePlan(): Promise<CoachPlan> {
  const plan = await serverPost<Omit<CoachPlan, 'generatedAt'>>('/coach/plan', {
    context: buildCoachContext(),
    library: library(),
  });
  return { ...plan, generatedAt: new Date().toISOString() };
}

interface SplitOut {
  name: string;
  notes: string;
  workouts: { title: string; focus: string; exercises: PlannedExercise[] }[];
}

/** AI-built split from goals, experience, equipment, targets. Not saved until the user keeps it. */
export async function generateSplit(daysPerWeek: number, request?: string): Promise<Split> {
  const out = await serverPost<SplitOut>('/coach/split', { context: buildCoachContext(), library: library(), daysPerWeek, request });
  const t = new Date().toISOString();
  return {
    id: uid(),
    name: out.name,
    notes: out.notes,
    source: 'ai',
    workouts: out.workouts.map((w) => ({ id: uid(), title: w.title, focus: w.focus, exercises: w.exercises })),
    createdAt: t,
    updatedAt: t,
  };
}

interface TargetPlanOut {
  summary: string;
  weekly: string[];
  actions: string[];
  stepGoal: number | null;
  workouts: { title: string; focus: string; exercises: PlannedExercise[] }[];
}

export async function generateTargetPlan(t: Target): Promise<TargetPlan> {
  const u = useStore.getState().units;
  const extra = t.kind === 'lift' ? ` (exercise: ${t.exercise})` : t.kind === 'run' ? ` (distance: ${t.runDistance ?? 'unspecified'})` : '';
  const out = await serverPost<TargetPlanOut>('/coach/target-plan', {
    context: buildCoachContext(),
    library: library(),
    target: `${t.title}${extra}: ${describeTarget(t, u)} (${TARGET_KIND_LABEL[t.kind]})`,
  });
  return {
    generatedAt: new Date().toISOString(),
    summary: out.summary,
    weekly: out.weekly,
    actions: out.actions,
    stepGoal: out.stepGoal,
    workouts: out.workouts.map((w) => ({ id: uid(), title: w.title, focus: w.focus, exercises: w.exercises })),
  };
}
