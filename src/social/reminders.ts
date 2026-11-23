// Daily workout reminders: settings live in the reminder_settings table (owner-only);
// the rep. server sends them (see server/src/reminders.ts).
import { PUSH_SERVER_URL } from '../config';
import { todayKey, useStore } from '../store';
import { friendly, requireSb, sb } from './supabase';

export interface ReminderSettings {
  push: boolean;
  email: boolean;
  /** "HH:MM", 24-hour */
  remindAt: string;
  restDay?: string;
}

export const DEFAULT_REMINDERS: ReminderSettings = { push: true, email: false, remindAt: '20:00' };

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
};
const serverUrl = () => (PUSH_SERVER_URL || useStore.getState().server.url).trim().replace(/\/$/, '');

/** Create the settings row with defaults if missing, and keep the phone's time zone current. Never throws. */
export async function ensureReminders() {
  const c = sb();
  const acct = useStore.getState().account;
  if (!c || !acct) return;
  try {
    await c.from('reminder_settings').upsert({ user_id: acct.userId, tz: tz(), updated_at: new Date().toISOString() });
    const { data } = await c.from('reminder_settings').select('rest_day').eq('user_id', acct.userId).maybeSingle();
    useStore.getState().set({ restDay: data?.rest_day ?? undefined });
  } catch {
    /* reminders are a bonus */
  }
}

export async function loadReminders(): Promise<ReminderSettings> {
  const acct = useStore.getState().account;
  if (!acct) return DEFAULT_REMINDERS;
  const { data, error } = await requireSb()
    .from('reminder_settings')
    .select('push, email, remind_at, rest_day')
    .eq('user_id', acct.userId)
    .maybeSingle();
  if (error) throw new Error(friendly(error));
  if (!data) return DEFAULT_REMINDERS;
  return { push: data.push, email: data.email, remindAt: String(data.remind_at).slice(0, 5), restDay: data.rest_day ?? undefined };
}

export async function saveReminders(patch: Partial<Omit<ReminderSettings, 'restDay'>>) {
  const acct = useStore.getState().account;
  if (!acct) throw new Error('Sign in first.');
  const row: Record<string, unknown> = { user_id: acct.userId, tz: tz(), updated_at: new Date().toISOString() };
  if (patch.push !== undefined) row.push = patch.push;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.remindAt !== undefined) row.remind_at = patch.remindAt;
  const { error } = await requireSb().from('reminder_settings').upsert(row);
  if (error) throw new Error(friendly(error));
}

/** Mark today as a rest day (no reminder tonight), or undo it. */
export async function setRestDay(on: boolean) {
  const acct = useStore.getState().account;
  if (!acct) throw new Error('Sign in first.');
  const day = on ? todayKey() : null;
  useStore.getState().set({ restDay: day ?? undefined });
  const { error } = await requireSb()
    .from('reminder_settings')
    .upsert({ user_id: acct.userId, tz: tz(), rest_day: day, updated_at: new Date().toISOString() });
  if (error) {
    useStore.getState().set({ restDay: on ? undefined : todayKey() });
    throw new Error(friendly(error));
  }
}

/** Whether the server can send push / email reminders yet. */
export async function reminderStatus(): Promise<{ push: boolean; email: boolean }> {
  try {
    const res = await fetch(`${serverUrl()}/reminders/status`);
    if (!res.ok) throw new Error();
    return (await res.json()) as { push: boolean; email: boolean };
  } catch {
    return { push: true, email: false };
  }
}

/** "20:00" → "8:00 pm" */
export function fmtReminderTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Move a "HH:MM" time by n minutes, wrapping around the day. */
export function shiftTime(hhmm: string, n: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
