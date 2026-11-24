// Splits (folders of workouts in a rolling order) and targets (measurable goals with a timeframe).
import { latestBody, lastNDates, counts } from './stats';
import { healthForDate, todayKey, type BodyEntry, type HealthDay, type Workout } from './store';
import { displayWeight, lbToKg, type Units, weightLabel } from './units';

// ───────────────────────── Splits ─────────────────────────

/** An exercise inside a saved workout, with an optional target like 4 × "8–10". */
export interface PlannedExercise {
  name: string;
  sets?: number;
  reps?: string;
}

export interface SplitWorkout {
  id: string;
  title: string;
  focus?: string;
  exercises: PlannedExercise[];
}

export type SplitSource = 'custom' | 'ai' | 'template' | 'coach';

export interface Split {
  id: string;
  name: string;
  notes?: string;
  source: SplitSource;
  workouts: SplitWorkout[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Rolling order: the workout after the last one finished from this split (wrapping around).
 * A missed day doesn't skip anything — the same workout is simply still "up next" tomorrow.
 */
export function upNext(split: Split, workouts: Workout[]): { workout: SplitWorkout; index: number; lastDone?: string } | undefined {
  if (!split.workouts.length) return undefined;
  // Most recent finished workout from this split. Workouts saved before split tags synced to the
  // cloud come back untagged after a reinstall, so fall back to matching the workout's title.
  const byTitle = new Map(split.workouts.map((sw) => [sw.title.trim().toLowerCase(), sw.id]));
  let lastId: string | undefined;
  let last: Workout | undefined;
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const id =
      w.splitId === split.id && w.splitWorkoutId
        ? w.splitWorkoutId
        : !w.splitId && w.startedAt >= split.createdAt
          ? byTitle.get(w.title.trim().toLowerCase())
          : undefined;
    if (id && (!last || w.startedAt > last.startedAt)) {
      last = w;
      lastId = id;
    }
  }
  if (!last) return { workout: split.workouts[0], index: 0 };
  const i = split.workouts.findIndex((sw) => sw.id === lastId);
  const next = i < 0 ? 0 : (i + 1) % split.workouts.length;
  return { workout: split.workouts[next], index: next, lastDone: last.startedAt };
}

/** Parse the first number of a reps target like "8–10" or "12" (for prefilling). */
export const firstReps = (reps?: string) => {
  const m = reps?.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
};

// ───────────────────────── Targets ─────────────────────────

export type TargetKind = 'bodyweight' | 'lift' | 'run' | 'steps' | 'workouts' | 'measurement' | 'custom';
export type MeasurementField = 'waistCm' | 'hipsCm' | 'bodyFatPct';

export interface CheckIn {
  date: string; // YYYY-MM-DD
  value: number; // canonical units (kg, cm, %, seconds, count)
}

export interface TargetPlan {
  generatedAt: string;
  summary: string;
  weekly: string[];
  actions: string[];
  stepGoal?: number | null;
  workouts: SplitWorkout[];
}

export interface Target {
  id: string;
  kind: TargetKind;
  title: string;
  /** title was generated from the numbers — regenerate it when they change */
  autoTitle?: boolean;
  /** canonical units: kg, cm, %, seconds (run), steps/day, workouts/week, or the custom unit */
  startValue: number;
  targetValue: number;
  unit?: string; // custom targets only (e.g. "pull-ups")
  exercise?: string; // lift targets
  measurement?: MeasurementField;
  runDistance?: string; // e.g. "1 mile" — run targets are times for a distance
  startDate: string;
  endDate: string;
  checkins: CheckIn[];
  plan?: TargetPlan;
  status: 'active' | 'done' | 'archived';
  /** earlier versions when the target or deadline was changed */
  history: { at: string; targetValue: number; endDate: string }[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  bodyweight: 'Body weight',
  lift: 'Lift',
  run: 'Run time',
  steps: 'Daily steps',
  workouts: 'Workouts per week',
  measurement: 'Measurement',
  custom: 'Something else',
};

export const MEASUREMENT_LABEL: Record<MeasurementField, string> = { waistCm: 'Waist', hipsCm: 'Hips', bodyFatPct: 'Body fat' };

/** Rate targets measure a level to keep up (steps/day, workouts/week); the rest move from start → target. */
export const isRate = (k: TargetKind) => k === 'steps' || k === 'workouts';

/** Is lower better? (weight loss, faster run, smaller waist…) */
export const lowerIsBetter = (t: Pick<Target, 'startValue' | 'targetValue' | 'kind'>) => !isRate(t.kind) && t.targetValue < t.startValue;

export interface Ctx {
  workouts: Workout[];
  body: BodyEntry[];
  health: Record<string, HealthDay>;
}

/** Heaviest working-set weight for an exercise in [from, to]. */
function heaviest(workouts: Workout[], exercise: string, from?: string, to?: string) {
  let best: number | undefined;
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const d = todayKey(new Date(w.startedAt));
    if ((from && d < from) || (to && d > to)) continue;
    for (const ex of w.exercises) {
      if (ex.name !== exercise) continue;
      for (const s of ex.sets) if (counts(s) && s.weightKg && (best == null || s.weightKg > best)) best = s.weightKg;
    }
  }
  return best;
}

function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** The current value for a target, from logged data where possible, else the latest check-in. */
export function currentValue(t: Target, ctx: Ctx): number | undefined {
  const lastCheckin = [...t.checkins].sort((a, b) => a.date.localeCompare(b.date)).pop()?.value;
  switch (t.kind) {
    case 'bodyweight':
      return latestBody(ctx.body, 'weightKg')?.weightKg ?? lastCheckin;
    case 'measurement':
      return (t.measurement ? (latestBody(ctx.body, t.measurement)?.[t.measurement] as number | undefined) : undefined) ?? lastCheckin;
    case 'lift':
      return (t.exercise ? heaviest(ctx.workouts, t.exercise, t.startDate) : undefined) ?? lastCheckin;
    case 'steps': {
      const vals = lastNDates(7)
        .map((d) => healthForDate(ctx.health, d).steps)
        .filter((v): v is number => v != null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined;
    }
    case 'workouts': {
      const from = weekStart();
      return ctx.workouts.filter((w) => w.finishedAt && new Date(w.startedAt) >= from).length;
    }
    default:
      return lastCheckin;
  }
}

/** Starting value suggestion when creating a target (what you're at today). */
export function suggestedStart(kind: TargetKind, ctx: Ctx, opts: { exercise?: string; measurement?: MeasurementField }) {
  const probe = {
    kind,
    checkins: [],
    startDate: '0000-01-01',
    exercise: opts.exercise,
    measurement: opts.measurement,
  } as unknown as Target;
  if (kind === 'lift' && opts.exercise) return heaviest(ctx.workouts, opts.exercise);
  return currentValue(probe, ctx);
}

const day = (s: string) => +new Date(s + 'T12:00');

export interface TargetStatus {
  current?: number;
  /** 0..1 */
  progress: number;
  /** where you'd be by now on a straight line from start to target (0..1) */
  expected: number;
  onTrack?: boolean;
  daysLeft: number;
  reached: boolean;
}

export function targetStatus(t: Target, ctx: Ctx, now = todayKey()): TargetStatus {
  // nothing logged since you set it → you're still at your starting point
  const current = currentValue(t, ctx) ?? (isRate(t.kind) ? undefined : t.startValue);
  const total = Math.max(1, (day(t.endDate) - day(t.startDate)) / 86400000);
  const elapsed = Math.min(total, Math.max(0, (day(now) - day(t.startDate)) / 86400000));
  const daysLeft = Math.max(0, Math.round((day(t.endDate) - day(now)) / 86400000));
  let progress = 0;
  if (current != null) {
    if (isRate(t.kind)) progress = t.targetValue > 0 ? current / t.targetValue : 0;
    else if (t.targetValue !== t.startValue) progress = (current - t.startValue) / (t.targetValue - t.startValue);
  }
  progress = Math.max(0, Math.min(1, progress));
  const expected = isRate(t.kind) ? 1 : elapsed / total;
  const reached = progress >= 1;
  const onTrack = current == null ? undefined : reached || progress + 0.05 >= expected;
  return { current, progress, expected, onTrack, daysLeft, reached };
}

/** History series for a target's chart (canonical units). */
export function targetSeries(t: Target, ctx: Ctx): { date: string; value: number }[] {
  const from = t.startDate;
  const pts: { date: string; value: number }[] = [];
  if (t.kind === 'bodyweight' || t.kind === 'measurement') {
    const f = t.kind === 'bodyweight' ? 'weightKg' : t.measurement;
    if (f) for (const b of ctx.body) if (b.date >= from && b[f] != null) pts.push({ date: b.date, value: b[f] as number });
  } else if (t.kind === 'lift' && t.exercise) {
    for (const w of [...ctx.workouts].reverse()) {
      if (!w.finishedAt) continue;
      const d = todayKey(new Date(w.startedAt));
      if (d < from) continue;
      const h = heaviest([w], t.exercise);
      if (h != null) pts.push({ date: d, value: h });
    }
  } else if (t.kind === 'steps') {
    for (const d of lastNDates(28)) {
      const v = healthForDate(ctx.health, d).steps;
      if (d >= from && v != null) pts.push({ date: d, value: v });
    }
  }
  for (const c of t.checkins) if (!pts.some((p) => p.date === c.date)) pts.push(c);
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}

// ── units for display / input ──

/** Unit label shown next to a target's numbers. */
export function targetUnit(t: Pick<Target, 'kind' | 'unit' | 'measurement'>, units: Units) {
  switch (t.kind) {
    case 'bodyweight':
    case 'lift':
      return weightLabel(units);
    case 'measurement':
      return t.measurement === 'bodyFatPct' ? '%' : units === 'us' ? 'in' : 'cm';
    case 'run':
      return '';
    case 'steps':
      return 'steps/day';
    case 'workouts':
      return 'per week';
    default:
      return t.unit ?? '';
  }
}

export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Canonical → display string (no unit). */
export function fmtTargetValue(t: Pick<Target, 'kind' | 'measurement'>, v: number | undefined, units: Units) {
  if (v == null) return '—';
  switch (t.kind) {
    case 'bodyweight':
    case 'lift':
      return displayWeight(v, units);
    case 'measurement':
      if (t.measurement === 'bodyFatPct') return String(Math.round(v * 10) / 10);
      return units === 'us' ? String(Math.round((v / 2.54) * 10) / 10) : String(Math.round(v));
    case 'run':
      return fmtTime(v);
    case 'steps':
      return Math.round(v).toLocaleString();
    default:
      return String(Math.round(v * 10) / 10);
  }
}

/** Display input → canonical. Accepts "6:30" for run times. Returns undefined if not a number. */
export function parseTargetInput(t: Pick<Target, 'kind' | 'measurement'>, text: string, units: Units): number | undefined {
  const s = text.trim().replace(',', '.');
  if (t.kind === 'run') {
    const m = s.match(/^(\d+):(\d{1,2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const n = parseFloat(s);
    return Number.isNaN(n) ? undefined : Math.round(n * 60); // plain number = minutes
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return undefined;
  if (t.kind === 'bodyweight' || t.kind === 'lift') return units === 'us' ? lbToKg(n) : n;
  if (t.kind === 'measurement' && t.measurement !== 'bodyFatPct') return units === 'us' ? n * 2.54 : n;
  return n;
}

/** One-line description, e.g. "Body weight 145 → 140 lb by Dec 8". */
export function describeTarget(t: Target, units: Units) {
  const u = targetUnit(t, units);
  const by = new Date(t.endDate + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (isRate(t.kind)) return `${fmtTargetValue(t, t.targetValue, units)} ${u} by ${by}`;
  return `${fmtTargetValue(t, t.startValue, units)} → ${fmtTargetValue(t, t.targetValue, units)}${u ? ' ' + u : ''} by ${by}`;
}

/** For the AI coach: targets as plain text in the user's units. */
export function targetsForCoach(targets: Target[], ctx: Ctx, units: Units) {
  return targets
    .filter((t) => t.status === 'active')
    .map((t) => {
      const st = targetStatus(t, ctx);
      const extra = t.kind === 'lift' ? ` (${t.exercise})` : t.kind === 'run' ? ` (${t.runDistance ?? 'run'})` : '';
      return `- ${t.title}${extra}: ${describeTarget(t, units)} · now ${fmtTargetValue(t, st.current, units)} · ${Math.round(st.progress * 100)}% · ${st.daysLeft} days left · ${st.onTrack === false ? 'behind pace' : 'on track'}`;
    })
    .join('\n');
}
