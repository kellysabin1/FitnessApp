import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ExerciseCategory, ExerciseDef, ExerciseKind } from './exercises';
import type { PlannedExercise, Split, Target } from './training';
import type { Units } from './units';

export type ConsentKind = 'terms_privacy' | 'health_data' | 'ai_coach' | 'challenge_sharing';
export interface ConsentRecord {
  version: number;
  granted: boolean;
  at: string;
}

// ---------- Types ----------
export type Goal = 'build_strength' | 'grow_glutes' | 'lose_fat' | 'recomp' | 'endurance' | 'flexibility' | 'consistency';

export const GOAL_LABEL: Record<Goal, string> = {
  build_strength: 'Get stronger',
  grow_glutes: 'Build lower body',
  lose_fat: 'Lose fat',
  recomp: 'Body recomp',
  endurance: 'Cardio endurance',
  flexibility: 'Mobility & flexibility',
  consistency: 'Build a habit',
};

export type Experience = 'beginner' | 'intermediate' | 'advanced';

export interface Profile {
  name: string;
  sex?: 'female' | 'male' | 'other';
  birthYear?: number;
  heightCm?: number;
  goalWeightKg?: number;
  goals: Goal[];
  experience: Experience;
  daysPerWeek: number;
  stepGoal: number;
  equipment: string; // free text: "full gym", "home dumbbells + reformer"…
  notes: string; // injuries, preferences
}

export interface SetEntry {
  /** warm-up sets don't count toward volume, PRs, set counts, comparisons or challenges */
  warmup?: boolean;
  reps?: number;
  weightKg?: number;
  seconds?: number;
  distanceKm?: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  kind: ExerciseKind;
  sets: SetEntry[];
  note?: string;
}

export interface Workout {
  id: string;
  title: string;
  startedAt: string; // ISO
  finishedAt?: string;
  exercises: WorkoutExercise[];
  notes?: string;
  mood?: number; // 1–5 how it felt
  /** true when entered after the fact rather than live */
  logged?: boolean;
  /** title of the challenge-plan workout this completes, if started from a plan */
  planItem?: string;
  /** started from a split (for the rolling "up next" order) */
  splitId?: string;
  splitWorkoutId?: string;
  /** last local edit (ISO) — used to sync changes */
  updatedAt?: string;
}

export interface Account {
  userId: string;
  email: string;
  username?: string;
  displayName?: string;
}

export interface BodyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  bodyFatPct?: number;
  waistCm?: number;
  hipsCm?: number;
  /** last local edit (ISO) — used to sync */
  updatedAt?: string;
}

export interface HealthDay {
  date: string; // YYYY-MM-DD
  steps?: number;
  activeKcal?: number;
  sleepHours?: number;
  restingHr?: number;
  hrvMs?: number;
  readiness?: number; // Oura readiness score 0–100
  sleepScore?: number;
  source: 'apple_health' | 'oura' | 'manual';
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface CoachPlan {
  generatedAt: string;
  headline: string;
  stepGoal: number;
  focus: string;
  /** exercises are structured since v6; older saved plans have plain strings */
  recommendations: { title: string; why: string; exercises: (PlannedExercise | string)[] }[];
  recovery: string;
  suggestedTargets?: SuggestedTarget[];
}

export interface SuggestedTarget {
  kind: import('./training').TargetKind;
  title: string;
  exercise: string | null;
  target_value: number;
  weeks: number;
  why: string;
}

export interface OuraAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
}

interface State {
  onboarded: boolean;
  units: Units;
  profile: Profile;
  workouts: Workout[];
  body: BodyEntry[];
  health: Record<string, HealthDay>; // keyed by `${source}:${date}`
  coach: CoachMessage[];
  plan?: CoachPlan;
  appleHealthEnabled: boolean;
  oura?: OuraAuth;
  server: { url: string; token: string };
  /** Exercises this person created (saved so they show up in search next time). */
  customExercises: ExerciseDef[];
  /** Workout splits (folders of workouts in a rolling order). */
  splits: Split[];
  activeSplitId?: string;
  /** Measurable targets with a timeframe (progress tracker). */
  targets: Target[];
  /** Signed-in friends & challenges account (undefined when signed out). */
  account?: Account;
  /** Last successful upload of workouts/steps (ISO). */
  lastSyncAt?: string;
  /** Workout ids deleted locally that still need deleting from the account. */
  pendingDeletes: string[];
  /** Body entry ids deleted locally that still need deleting from the account. */
  pendingBodyDeletes: string[];
  /** Invite code opened before the person had an account — joined right after setup. */
  pendingInvite?: string;
  /** a day you marked as a rest day (no reminder that day) */
  restDay?: string;
  /** Latest answer per consent kind (see src/consent.ts) — mirrors the account's consent log. */
  consents: Partial<Record<ConsentKind, ConsentRecord>>;
  /** Consents given before the account had a profile row; saved to the account right after. */
  pendingConsents: (ConsentRecord & { kind: ConsentKind; context?: string })[];
  /** Account id this device's data belongs to (so a different person signing in starts clean). */
  dataOwner?: string;
  /** Last local change to profile, units or custom exercises (ISO) — used to sync. */
  userDataUpdatedAt?: string;
  /** Result of the last coach connection check. */
  coachStatus?: 'ok' | 'unauthorized' | 'unreachable' | 'no_access';

  // actions
  set: (patch: Partial<State>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  startWorkout: (title?: string, planItem?: string, split?: { splitId: string; splitWorkoutId: string }) => string;
  /** Create an already-finished workout that happened in the past. */
  logPastWorkout: (title: string, startedAt: Date, durationMin: number, planItem?: string) => string;
  updateWorkout: (id: string, fn: (w: Workout) => Workout) => void;
  finishWorkout: (id: string, mood?: number) => void;
  deleteWorkout: (id: string) => void;
  /** Add/replace workouts pulled from the account (cloud restore). */
  mergeWorkouts: (ws: Workout[]) => void;
  addBody: (e: Omit<BodyEntry, 'id'>) => void;
  deleteBody: (id: string) => void;
  upsertHealth: (days: HealthDay[]) => void;
  addCoachMessage: (m: Omit<CoachMessage, 'id' | 'at'>) => void;
  addCustomExercise: (e: ExerciseDef) => void;
  saveSplit: (s: Split) => void;
  deleteSplit: (id: string) => void;
  setActiveSplit: (id?: string) => void;
  saveTarget: (t: Target) => void;
  deleteTarget: (id: string) => void;
  deleteCustomExercise: (name: string) => void;
  clearCoach: () => void;
  resetAll: () => void;
}

const now = () => new Date().toISOString();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const defaultProfile: Profile = {
  name: '',
  goals: [],
  experience: 'beginner',
  daysPerWeek: 4,
  stepGoal: 8000,
  equipment: 'Full gym',
  notes: '',
};

const initial = {
  onboarded: false,
  units: 'us' as Units,
  profile: defaultProfile,
  workouts: [] as Workout[],
  body: [] as BodyEntry[],
  health: {} as Record<string, HealthDay>,
  coach: [] as CoachMessage[],
  plan: undefined,
  appleHealthEnabled: false,
  oura: undefined,
  coachStatus: undefined,
  account: undefined,
  customExercises: [] as ExerciseDef[],
  splits: [] as Split[],
  activeSplitId: undefined as string | undefined,
  targets: [] as Target[],
  lastSyncAt: undefined,
  pendingDeletes: [] as string[],
  pendingBodyDeletes: [] as string[],
  consents: {} as Partial<Record<ConsentKind, ConsentRecord>>,
  pendingConsents: [] as (ConsentRecord & { kind: ConsentKind; context?: string })[],
  dataOwner: undefined as string | undefined,
  userDataUpdatedAt: undefined as string | undefined,
  server: {
    url: process.env.EXPO_PUBLIC_COACH_URL ?? '',
    token: process.env.EXPO_PUBLIC_COACH_TOKEN ?? '',
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (patch) =>
        // changing units counts as a profile/settings change for syncing
        set('units' in patch && patch.units !== get().units ? { ...patch, userDataUpdatedAt: now() } : patch),
      updateProfile: (patch) => set({ profile: { ...get().profile, ...patch }, userDataUpdatedAt: now() }),
      startWorkout: (title, planItem, split) => {
        const id = uid();
        const w: Workout = {
          id,
          title: title || defaultWorkoutTitle(),
          startedAt: new Date().toISOString(),
          exercises: [],
          planItem,
          splitId: split?.splitId,
          splitWorkoutId: split?.splitWorkoutId,
          updatedAt: new Date().toISOString(),
        };
        set({ workouts: [w, ...get().workouts] });
        return id;
      },
      logPastWorkout: (title, startedAt, durationMin, planItem) => {
        const id = uid();
        const w: Workout = {
          id,
          title: title || 'Workout',
          startedAt: startedAt.toISOString(),
          finishedAt: new Date(+startedAt + durationMin * 60000).toISOString(),
          exercises: [],
          logged: true,
          planItem,
          updatedAt: new Date().toISOString(),
        };
        set({ workouts: sortWorkouts([w, ...get().workouts]) });
        return id;
      },
      updateWorkout: (id, fn) =>
        set({
          workouts: sortWorkouts(get().workouts.map((w) => (w.id === id ? { ...fn(w), updatedAt: new Date().toISOString() } : w))),
        }),
      finishWorkout: (id, mood) =>
        set({
          workouts: get().workouts.map((w) =>
            w.id === id ? { ...w, finishedAt: new Date().toISOString(), mood, updatedAt: new Date().toISOString() } : w,
          ),
        }),
      mergeWorkouts: (ws) => {
        const byId = new Map(get().workouts.map((w) => [w.id, w]));
        for (const w of ws) byId.set(w.id, w);
        set({ workouts: sortWorkouts([...byId.values()]) });
      },
      deleteWorkout: (id) =>
        set({
          workouts: get().workouts.filter((w) => w.id !== id),
          pendingDeletes: get().account ? [...get().pendingDeletes, id] : get().pendingDeletes,
        }),
      addBody: (e) => {
        // one entry per day: merge into an existing entry for the same date
        const existing = get().body.find((b) => b.date === e.date);
        const merged = existing
          ? get().body.map((b) => (b.date === e.date ? { ...b, ...stripUndefined(e), updatedAt: now() } : b))
          : [...get().body, { ...e, id: uid(), updatedAt: now() }];
        set({ body: merged.sort((a, b) => a.date.localeCompare(b.date)) });
      },
      deleteBody: (id) =>
        set({
          body: get().body.filter((b) => b.id !== id),
          pendingBodyDeletes: get().account ? [...get().pendingBodyDeletes, id] : get().pendingBodyDeletes,
        }),
      upsertHealth: (days) => {
        const next = { ...get().health };
        for (const d of days) next[`${d.source}:${d.date}`] = { ...next[`${d.source}:${d.date}`], ...stripUndefined(d) } as HealthDay;
        set({ health: next });
      },
      addCoachMessage: (m) => set({ coach: [...get().coach, { ...m, id: uid(), at: new Date().toISOString() }] }),
      clearCoach: () => set({ coach: [] }),
      addCustomExercise: (e) => {
        const rest = (get().customExercises ?? []).filter((x) => x.name.toLowerCase() !== e.name.toLowerCase());
        set({
          customExercises: [...rest, { ...e, custom: true }].sort((a, b) => a.name.localeCompare(b.name)),
          userDataUpdatedAt: now(),
        });
      },
      saveSplit: (sp) => {
        const next = { ...sp, updatedAt: now() };
        const exists = get().splits.some((x) => x.id === sp.id);
        set({ splits: exists ? get().splits.map((x) => (x.id === sp.id ? next : x)) : [...get().splits, next], userDataUpdatedAt: now() });
      },
      deleteSplit: (id) =>
        set({
          splits: get().splits.filter((x) => x.id !== id),
          activeSplitId: get().activeSplitId === id ? undefined : get().activeSplitId,
          userDataUpdatedAt: now(),
        }),
      setActiveSplit: (id) => set({ activeSplitId: id, userDataUpdatedAt: now() }),
      saveTarget: (t) => {
        const next = { ...t, updatedAt: now() };
        const exists = get().targets.some((x) => x.id === t.id);
        set({
          targets: exists ? get().targets.map((x) => (x.id === t.id ? next : x)) : [...get().targets, next],
          userDataUpdatedAt: now(),
        });
      },
      deleteTarget: (id) => set({ targets: get().targets.filter((x) => x.id !== id), userDataUpdatedAt: now() }),
      deleteCustomExercise: (name) =>
        set({ customExercises: (get().customExercises ?? []).filter((x) => x.name !== name), userDataUpdatedAt: now() }),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'rep-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { set: _s, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<State>;
      },
    },
  ),
);

/** Newest first; an in-progress workout always stays on top. */
function sortWorkouts(ws: Workout[]) {
  return [...ws].sort((a, b) => {
    if (!a.finishedAt !== !b.finishedAt) return a.finishedAt ? 1 : -1;
    return b.startedAt.localeCompare(a.startedAt);
  });
}

function defaultWorkoutTitle() {
  const h = new Date().getHours();
  if (h < 11) return 'Morning session';
  if (h < 17) return 'Afternoon session';
  return 'Evening session';
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Merge all sources for a given date into one view (Oura wins for sleep/readiness, Apple Health for steps). */
export function healthForDate(health: Record<string, HealthDay>, date: string) {
  const ah = health[`apple_health:${date}`];
  const oura = health[`oura:${date}`];
  const manual = health[`manual:${date}`];
  return {
    steps: ah?.steps ?? oura?.steps ?? manual?.steps,
    activeKcal: ah?.activeKcal ?? oura?.activeKcal,
    sleepHours: oura?.sleepHours ?? ah?.sleepHours,
    restingHr: oura?.restingHr ?? ah?.restingHr,
    hrvMs: oura?.hrvMs ?? ah?.hrvMs,
    readiness: oura?.readiness,
    sleepScore: oura?.sleepScore,
  };
}
