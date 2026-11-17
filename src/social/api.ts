// Everything that talks to the friends & challenges backend.
import type { Session } from '@supabase/supabase-js';
import { setsDone, workoutDurationMin, workoutVolumeKg } from '../stats';
import { healthForDate, todayKey, useStore, type Workout } from '../store';
import { friendly, requireSb, sb } from './supabase';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
}

// ─────────────── Account ───────────────

export async function signUp(email: string, password: string) {
  const { data, error } = await requireSb().auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(friendly(error));
  if (!data.session) {
    throw new Error('Check your email to confirm your account, then sign in. (Tip: turn off "Confirm email" in Supabase for instant sign-up.)');
  }
  await onSignedIn(data.session);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireSb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error));
  await onSignedIn(data.session);
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireSb().auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(friendly(error));
}

export async function signOut() {
  await sb()?.auth.signOut();
  useStore.getState().set({ account: undefined, lastSyncAt: undefined, pendingDeletes: [] });
}

async function onSignedIn(session: Session) {
  const set = useStore.getState().set;
  set({ account: { userId: session.user.id, email: session.user.email ?? '' } });
  const p = await myProfile();
  if (p) set({ account: { userId: session.user.id, email: session.user.email ?? '', username: p.username, displayName: p.display_name } });
  await pullWorkouts().catch(() => {});
  await syncUp().catch(() => {});
}

/** On app start: restore the account from a saved session (or clear it if the session is gone). */
export async function restoreSession() {
  const c = sb();
  if (!c) return;
  const { data } = await c.auth.getSession();
  if (!data.session) {
    if (useStore.getState().account) useStore.getState().set({ account: undefined });
    return;
  }
  const acct = useStore.getState().account;
  if (!acct || acct.userId !== data.session.user.id || !acct.username) await onSignedIn(data.session);
  else syncUp().catch(() => {});
}

export async function accessToken() {
  const { data } = await requireSb().auth.getSession();
  return data.session?.access_token;
}

// ─────────────── Profile ───────────────

export async function myProfile(): Promise<Profile | null> {
  const c = requireSb();
  const { data: u } = await c.auth.getUser();
  if (!u.user) return null;
  const { data } = await c.from('profiles').select('id, username, display_name').eq('id', u.user.id).maybeSingle();
  return (data as Profile) ?? null;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function saveProfile(username: string, displayName: string) {
  const c = requireSb();
  const acct = useStore.getState().account;
  if (!acct) throw new Error('Sign in first.');
  const u = username.trim().toLowerCase().replace(/^@/, '');
  if (!USERNAME_RE.test(u)) throw new Error('Usernames are 3–20 lowercase letters, numbers or _.');
  const { error } = await c
    .from('profiles')
    .upsert({ id: acct.userId, username: u, display_name: displayName.trim().slice(0, 40) });
  if (error) throw new Error(friendly(error));
  useStore.getState().set({ account: { ...acct, username: u, displayName: displayName.trim() } });
}

// ─────────────── Sync (also your cloud backup) ───────────────

function toRow(userId: string, w: Workout) {
  return {
    user_id: userId,
    id: w.id,
    title: w.title,
    started_at: w.startedAt,
    finished_at: w.finishedAt!,
    local_day: todayKey(new Date(w.startedAt)),
    duration_min: workoutDurationMin(w),
    sets_done: setsDone(w),
    volume_kg: Math.round(workoutVolumeKg(w)),
    plan_item: w.planItem ?? null,
    exercises: w.exercises,
    updated_at: w.updatedAt ?? w.finishedAt!,
  };
}

/** Upload finished workouts and the last 30 days of steps that changed since the last sync. */
export async function syncUp() {
  const c = sb();
  const s = useStore.getState();
  if (!c || !s.account?.username) return;
  const since = s.lastSyncAt ?? '1970-01-01';
  const started = new Date().toISOString();

  const changed = s.workouts.filter((w) => w.finishedAt && (w.updatedAt ?? w.finishedAt) > since);
  if (changed.length) {
    const { error } = await c.from('workouts').upsert(changed.map((w) => toRow(s.account!.userId, w)));
    if (error) throw new Error(friendly(error));
  }
  if (s.pendingDeletes.length) {
    const { error } = await c.from('workouts').delete().eq('user_id', s.account.userId).in('id', s.pendingDeletes);
    if (!error) useStore.getState().set({ pendingDeletes: [] });
  }

  const steps: { user_id: string; day: string; steps: number; source: string }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = todayKey(d);
    const v = healthForDate(s.health, day).steps;
    if (v != null) {
      const src = s.health[`apple_health:${day}`]?.steps != null ? 'apple_health' : s.health[`oura:${day}`]?.steps != null ? 'oura' : 'manual';
      steps.push({ user_id: s.account.userId, day, steps: Math.min(200000, Math.round(v)), source: src });
    }
  }
  if (steps.length) {
    const { error } = await c.from('daily_steps').upsert(steps);
    if (error) throw new Error(friendly(error));
  }
  useStore.getState().set({ lastSyncAt: started });
}

/** Bring down workouts from the account that this phone doesn't have (new phone / reinstall). */
export async function pullWorkouts() {
  const c = requireSb();
  const acct = useStore.getState().account;
  if (!acct) return;
  const { data, error } = await c
    .from('workouts')
    .select('id, title, started_at, finished_at, exercises, plan_item, updated_at')
    .eq('user_id', acct.userId)
    .order('started_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(friendly(error));
  const local = new Map(useStore.getState().workouts.map((w) => [w.id, w]));
  const incoming: Workout[] = [];
  for (const r of data ?? []) {
    const mine = local.get(r.id);
    if (mine && (mine.updatedAt ?? '') >= r.updated_at) continue;
    incoming.push({
      id: r.id,
      title: r.title,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      exercises: r.exercises ?? [],
      planItem: r.plan_item ?? undefined,
      updatedAt: r.updated_at,
    });
  }
  if (incoming.length) useStore.getState().mergeWorkouts(incoming);
}

// ─────────────── Friends ───────────────

export interface Friendship {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  other: Profile;
  incoming: boolean;
}

export async function searchUsers(q: string): Promise<Profile[]> {
  const term = q.trim().toLowerCase().replace(/^@/, '');
  if (term.length < 2) return [];
  const me = useStore.getState().account?.userId;
  const { data, error } = await requireSb()
    .from('profiles')
    .select('id, username, display_name')
    .or(`username.ilike.${term.replace(/[%_,()]/g, '')}%,display_name.ilike.%${term.replace(/[%_,()]/g, '')}%`)
    .limit(20);
  if (error) throw new Error(friendly(error));
  return ((data as Profile[]) ?? []).filter((p) => p.id !== me);
}

export async function listFriendships(): Promise<Friendship[]> {
  const me = useStore.getState().account?.userId;
  const { data, error } = await requireSb()
    .from('friendships')
    .select(
      'requester, addressee, status, req:profiles!friendships_requester_fkey(id, username, display_name), add:profiles!friendships_addressee_fkey(id, username, display_name)',
    );
  if (error) throw new Error(friendly(error));
  return (data ?? []).map((r: any) => {
    const incoming = r.addressee === me;
    return { requester: r.requester, addressee: r.addressee, status: r.status, incoming, other: incoming ? r.req : r.add };
  });
}

export async function sendFriendRequest(userId: string) {
  const me = useStore.getState().account!.userId;
  const { error } = await requireSb().from('friendships').insert({ requester: me, addressee: userId });
  if (error) throw new Error(friendly(error));
}

export async function acceptFriend(requester: string) {
  const me = useStore.getState().account!.userId;
  const { error } = await requireSb()
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester', requester)
    .eq('addressee', me);
  if (error) throw new Error(friendly(error));
}

export async function removeFriendship(f: Pick<Friendship, 'requester' | 'addressee'>) {
  const { error } = await requireSb().from('friendships').delete().eq('requester', f.requester).eq('addressee', f.addressee);
  if (error) throw new Error(friendly(error));
}

// ─────────────── Challenges ───────────────

export interface PlanItem {
  title: string;
  exercises: string[];
}

export interface Challenge {
  id: string;
  name: string;
  created_by: string;
  starts_on: string;
  ends_on: string;
  invite_code: string;
  score_workouts: boolean;
  score_steps: boolean;
  score_streaks: boolean;
  score_plan: boolean;
  step_goal: number;
  plan: PlanItem[];
}

export interface LeaderRow {
  user_id: string;
  username: string;
  display_name: string;
  workouts: number;
  steps: number;
  streak_days: number;
  plan_done: number;
  current_streak: number;
  points: number;
}

export interface FeedItem {
  id: number;
  user_id: string;
  kind: 'created' | 'joined' | 'workout' | 'steps' | 'nudge';
  payload: Record<string, any>;
  created_at: string;
  who: Profile;
  reactions: { user_id: string; emoji: string }[];
}

export const REACTIONS = ['👏', '🔥', '💪', '❤️'] as const;

export async function myChallenges(): Promise<Challenge[]> {
  const { data, error } = await requireSb().from('challenges').select('*').order('ends_on', { ascending: false });
  if (error) throw new Error(friendly(error));
  return (data as Challenge[]) ?? [];
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await requireSb().from('challenges').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(friendly(error));
  return (data as Challenge) ?? null;
}

export async function createChallenge(input: {
  name: string;
  startsOn: string;
  endsOn: string;
  scoreWorkouts: boolean;
  scoreSteps: boolean;
  scoreStreaks: boolean;
  scorePlan: boolean;
  stepGoal: number;
  plan: PlanItem[];
}): Promise<Challenge> {
  await syncUp().catch(() => {});
  const { data, error } = await requireSb().rpc('create_challenge', {
    p_name: input.name.trim(),
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_score_workouts: input.scoreWorkouts,
    p_score_steps: input.scoreSteps,
    p_score_streaks: input.scoreStreaks,
    p_score_plan: input.scorePlan,
    p_step_goal: input.stepGoal,
    p_plan: input.plan,
  });
  if (error) throw new Error(friendly(error));
  return data as Challenge;
}

export async function joinChallenge(code: string): Promise<string> {
  await syncUp().catch(() => {});
  const { data, error } = await requireSb().rpc('join_challenge', { p_code: code.trim() });
  if (error) throw new Error(friendly(error));
  return data as string;
}

export async function addFriendToChallenge(challengeId: string, friendId: string) {
  const { error } = await requireSb().rpc('add_friend_to_challenge', { p_challenge: challengeId, p_friend: friendId });
  if (error) throw new Error(friendly(error));
}

export async function leaveChallenge(challengeId: string) {
  const me = useStore.getState().account!.userId;
  const { error } = await requireSb().from('challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', me);
  if (error) throw new Error(friendly(error));
}

export async function leaderboard(challengeId: string): Promise<LeaderRow[]> {
  const { data, error } = await requireSb().rpc('challenge_leaderboard', { p_challenge: challengeId });
  if (error) throw new Error(friendly(error));
  return (data as LeaderRow[]) ?? [];
}

export async function feed(challengeId: string): Promise<FeedItem[]> {
  const { data, error } = await requireSb()
    .from('activity')
    .select('id, user_id, kind, payload, created_at, who:profiles!activity_user_id_fkey(id, username, display_name), reactions(user_id, emoji)')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(friendly(error));
  return (data as unknown as FeedItem[]) ?? [];
}

export async function toggleReaction(item: FeedItem, emoji: string) {
  const me = useStore.getState().account!.userId;
  const c = requireSb();
  const mine = item.reactions.some((r) => r.user_id === me && r.emoji === emoji);
  const { error } = mine
    ? await c.from('reactions').delete().eq('activity_id', item.id).eq('user_id', me).eq('emoji', emoji)
    : await c.from('reactions').insert({ activity_id: item.id, user_id: me, emoji });
  if (error) throw new Error(friendly(error));
}

/** A friendly poke ("time to move!") to one member, or the whole group. */
export async function nudge(challengeId: string, toUserId?: string) {
  const me = useStore.getState().account!.userId;
  const { data, error } = await requireSb()
    .from('activity')
    .insert({ challenge_id: challengeId, user_id: me, kind: 'nudge', payload: toUserId ? { to: toUserId } : {} })
    .select('id')
    .single();
  if (error) throw new Error(friendly(error));
  return data.id as number;
}

/**
 * After finishing (or logging) a workout: sync it, post it to every challenge that's running,
 * and return the new feed item ids (used to send notifications).
 */
export async function shareFinishedWorkout(w: Workout): Promise<number[]> {
  const c = sb();
  const acct = useStore.getState().account;
  if (!c || !acct?.username || !w.finishedAt) return [];
  await syncUp();
  const day = todayKey(new Date(w.startedAt));
  const running = (await myChallenges()).filter((ch) => ch.starts_on <= day && day <= ch.ends_on);
  if (!running.length) return [];
  const payload = {
    workout_id: w.id,
    title: w.title,
    duration_min: workoutDurationMin(w),
    sets: setsDone(w),
    plan_item: w.planItem ?? null,
    logged: !!w.logged,
  };
  const { data, error } = await c
    .from('activity')
    .insert(running.map((ch) => ({ challenge_id: ch.id, user_id: acct.userId, kind: 'workout', payload })))
    .select('id');
  if (error) throw new Error(friendly(error));
  return (data ?? []).map((r: { id: number }) => r.id);
}
