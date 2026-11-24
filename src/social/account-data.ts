// "Download my data" and "Delete my account" (REP-5). Format documented in docs/PRIVACY.md → "Your data export".
import { Platform, Share } from 'react-native';
import { PUSH_SERVER_URL } from '../config';
import { useStore } from '../store';
import { accessToken } from './api';
import { friendly, requireSb } from './supabase';

export const EXPORT_FORMAT = 'rep-export';
export const EXPORT_VERSION = 1;

const serverUrl = () => (PUSH_SERVER_URL || useStore.getState().server.url).trim().replace(/\/$/, '');

/** Everything rep. holds about you: what's in your account, plus what's only on this phone. */
export async function buildExport() {
  const acct = useStore.getState().account;
  if (!acct) throw new Error('Sign in first.');
  const c = requireSb();
  const me = acct.userId;
  const q = async (table: string, column = 'user_id', select = '*') => {
    const { data, error } = await c.from(table).select(select).eq(column, me);
    if (error) throw new Error(friendly(error));
    return data ?? [];
  };
  const [
    profile,
    userData,
    body,
    workouts,
    steps,
    reminders,
    consents,
    memberships,
    created,
    activity,
    taskChecks,
    friendsOut,
    friendsIn,
    devices,
  ] = await Promise.all([
    q('profiles', 'id', 'id, username, display_name, created_at'),
    q('user_data'),
    q('body_entries'),
    q('workouts'),
    q('daily_steps'),
    q('reminder_settings'),
    q('consents'),
    q('challenge_members'),
    q('challenges', 'created_by'),
    q('activity'),
    q('task_checks'),
    q('friendships', 'requester'),
    q('friendships', 'addressee'),
    // device keys are secrets for sending you notifications; export only which devices are registered
    q('push_subscriptions', 'user_id', 'created_at'),
  ]);
  const s = useStore.getState();
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    units: 'Weights in kg, lengths in cm, durations in minutes; times are ISO 8601 (UTC).',
    account: { userId: me, email: acct.email, username: acct.username, displayName: acct.displayName },
    cloud: {
      profile: profile[0] ?? null,
      userData: userData[0] ?? null,
      bodyEntries: body,
      workouts,
      dailySteps: steps,
      reminderSettings: reminders[0] ?? null,
      consents,
      challengeMemberships: memberships,
      challengesCreated: created,
      feedItems: activity,
      dailyTaskChecks: taskChecks,
      friendships: [...friendsOut, ...friendsIn],
      notificationDevices: devices.length,
    },
    thisPhone: {
      note: 'Only on this device (not in your account): wearable data, AI coach chat and your latest coach plan.',
      health: s.health,
      coachChat: s.coach,
      coachPlan: s.plan ?? null,
    },
  };
}

/** Save the export as a JSON file (web) or open the share sheet (iPhone app). */
export async function downloadExport() {
  const data = await buildExport();
  const json = JSON.stringify(data, null, 2);
  const name = `rep-data-${data.exportedAt.slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } else {
    await Share.share({ title: name, message: json });
  }
  return name;
}

/** Permanently delete the account and everything in it, then clear this phone. */
export async function deleteAccount(password: string) {
  const token = await accessToken();
  if (!token) throw new Error('Sign in again, then try once more.');
  const res = await fetch(`${serverUrl()}/account/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  }).catch(() => null);
  if (!res) throw new Error('Can’t reach the rep. server — check your connection and try again.');
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? 'Couldn’t delete your account. Please try again.');
  await requireSb()
    .auth.signOut({ scope: 'local' })
    .catch(() => {});
  useStore.getState().resetAll();
}
