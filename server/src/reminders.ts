// Daily workout reminders.
// Supabase's scheduler (supabase/jobs.sql) calls POST /reminders/run every 15 minutes with a
// shared key. due_reminders() in the database decides who is due (their time has passed, nothing logged
// today, not a rest day, not reminded yet), so this file only has to send the messages.
import type { Express, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

import { alertOwnerAboutDowntime } from './monitoring.js';
import { pushToUsers } from './push.js';
import { db, supabaseConfigured } from './supabase.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const REMINDER_FROM = process.env.REMINDER_FROM ?? 'rep. <onboarding@resend.dev>';
const APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '');

export const emailConfigured = () => !!RESEND_API_KEY;

let cronKey: string | null = null;
async function getCronKey(): Promise<string | null> {
  if (cronKey) return cronKey;
  const { data } = await db().from('app_secrets').select('value').eq('key', 'reminder_cron_key').maybeSingle();
  cronKey = data?.value ?? null;
  return cronKey;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

interface Due {
  user_id: string;
  push: boolean;
  email: boolean;
  local_day: string;
}

/** "Up next: Lower A" from the person's active split, if they have one. Best effort. */
async function upNextTitle(userId: string): Promise<string | null> {
  const { data: ud } = await db().from('user_data').select('settings, splits').eq('user_id', userId).maybeSingle();
  const activeId = ud?.settings?.activeSplitId;
  const split = Array.isArray(ud?.splits) ? ud.splits.find((s: any) => s?.id === activeId) : null;
  const list: { id: string; title: string }[] = Array.isArray(split?.workouts) ? split.workouts : [];
  if (!list.length) return null;
  const { data: last } = await db()
    .from('workouts')
    .select('split_workout_id')
    .eq('user_id', userId)
    .eq('split_id', activeId)
    .not('split_workout_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const i = last ? list.findIndex((w) => w.id === last.split_workout_id) : -1;
  return list[(i + 1) % list.length]?.title ?? null;
}

async function sendEmail(userId: string, subject: string, text: string): Promise<boolean> {
  const { data, error } = await db().auth.admin.getUserById(userId);
  const to = data?.user?.email;
  if (error || !to) return false;
  const link = APP_URL || 'https://rep-app.onrender.com';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMINDER_FROM,
      to: [to],
      subject,
      text: `${text}\n\nOpen rep.: ${link}\n\nChange or turn off reminders: You → Reminders in the app.`,
      html: `<div style="font-family:Georgia,serif;color:#2B211C;max-width:480px">
        <p style="font-size:22px;margin:0 0 12px">${subject}</p>
        <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;margin:0 0 20px">${text}</p>
        <p><a href="${link}" style="font-family:Arial,sans-serif;background:#2B211C;color:#E8E0D2;padding:10px 18px;border-radius:999px;text-decoration:none">Open rep.</a></p>
        <p style="font-family:Arial,sans-serif;font-size:12px;color:#7a6e62;margin-top:24px">Change or turn off reminders anytime: You → Reminders.</p>
      </div>`,
    }),
  });
  if (!res.ok) console.error('reminder email failed', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export function mountReminderRoutes(app: Express) {
  // The app asks this to know whether to offer email reminders yet.
  app.get('/reminders/status', (_req: Request, res: Response) => {
    res.json({ push: supabaseConfigured(), email: supabaseConfigured() && emailConfigured() });
  });

  app.post('/reminders/run', async (req: Request, res: Response) => {
    if (!supabaseConfigured()) return void res.status(503).json({ error: 'Not configured' });
    const given = String(req.headers['x-cron-key'] ?? '');
    const key = await getCronKey().catch(() => null);
    if (!key || !given || !same(given, key)) return void res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await db().rpc('due_reminders');
    if (error) {
      console.error('due_reminders failed', error.message);
      return void res.status(500).json({ error: 'Could not load reminders' });
    }
    let pushed = 0;
    let emailed = 0;
    for (const d of (data ?? []) as Due[]) {
      try {
        // mark first: if sending throws halfway, nobody gets the same reminder twice
        await db().rpc('mark_reminded', { p_user: d.user_id, p_day: d.local_day });
        const next = await upNextTitle(d.user_id).catch(() => null);
        const title = 'No workout logged yet today';
        const body = next
          ? `Up next: ${next}. Even a short session counts — or mark today as a rest day.`
          : 'Even a short session counts — or mark today as a rest day.';
        if (d.push) pushed += await pushToUsers([d.user_id], { title, body, url: '/', tag: `reminder-${d.local_day}` }, 60 * 60 * 3);
        if (d.email && emailConfigured() && (await sendEmail(d.user_id, title, body))) emailed++;
      } catch (e) {
        console.error('reminder failed for a user', e);
      }
    }
    await alertOwnerAboutDowntime();
    res.json({ due: data?.length ?? 0, pushed, emailed });
  });
}
