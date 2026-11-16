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
        const done = ex.sets.filter((x) => x.done);
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

export async function generatePlan(): Promise<CoachPlan> {
  const plan = await serverPost<Omit<CoachPlan, 'generatedAt'>>('/coach/plan', {
    context: buildCoachContext(),
  });
  return { ...plan, generatedAt: new Date().toISOString() };
}
