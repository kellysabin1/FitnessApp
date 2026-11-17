import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ExerciseCategory, ExerciseKind } from './exercises';
import type { Units } from './units';

// ---------- Types ----------
export type Goal =
  | 'build_strength'
  | 'grow_glutes'
  | 'lose_fat'
  | 'recomp'
  | 'endurance'
  | 'flexibility'
  | 'consistency';

export const GOAL_LABEL: Record<Goal, string> = {
  build_strength: 'Get stronger',
  grow_glutes: 'Build glutes & legs',
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
  recommendations: { title: string; why: string; exercises: string[] }[];
  recovery: string;
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
  /** Signed-in friends & challenges account (undefined when signed out). */
  account?: Account;
  /** Last successful upload of workouts/steps (ISO). */
  lastSyncAt?: string;
  /** Workout ids deleted locally that still need deleting from the account. */
  pendingDeletes: string[];
  /** Result of the last coach connection check. */
  coachStatus?: 'ok' | 'unauthorized' | 'unreachable' | 'no_access';

  // actions
  set: (patch: Partial<State>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  startWorkout: (title?: string, planItem?: string) => string;
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
  clearCoach: () => void;
  resetAll: () => void;
}

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
  lastSyncAt: undefined,
  pendingDeletes: [] as string[],
  server: {
    url: process.env.EXPO_PUBLIC_COACH_URL ?? '',
    token: process.env.EXPO_PUBLIC_COACH_TOKEN ?? '',
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (patch) => set(patch),
      updateProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      startWorkout: (title, planItem) => {
        const id = uid();
        const w: Workout = {
          id,
          title: title || defaultWorkoutTitle(),
          startedAt: new Date().toISOString(),
          exercises: [],
          planItem,
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
          workouts: sortWorkouts(
            get().workouts.map((w) => (w.id === id ? { ...fn(w), updatedAt: new Date().toISOString() } : w)),
          ),
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
          ? get().body.map((b) => (b.date === e.date ? { ...b, ...stripUndefined(e) } : b))
          : [...get().body, { ...e, id: uid() }];
        set({ body: merged.sort((a, b) => a.date.localeCompare(b.date)) });
      },
      deleteBody: (id) => set({ body: get().body.filter((b) => b.id !== id) }),
      upsertHealth: (days) => {
        const next = { ...get().health };
        for (const d of days) next[`${d.source}:${d.date}`] = { ...next[`${d.source}:${d.date}`], ...stripUndefined(d) } as HealthDay;
        set({ health: next });
      },
      addCoachMessage: (m) =>
        set({ coach: [...get().coach, { ...m, id: uid(), at: new Date().toISOString() }] }),
      clearCoach: () => set({ coach: [] }),
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
