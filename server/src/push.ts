// Friend notifications (Web Push). Signed-in rep. users call these with their Supabase login,
// not the coach password, so friends get notifications without needing coach access.
import type { Express, Request, Response } from 'express';
import * as webpush from 'web-push';
import { z } from 'zod';

import { db, supabaseConfigured, userFromRequest } from './supabase.js';

const APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '');

let vapidPublic: string | null = null;

export const pushConfigured = supabaseConfigured;

/**
 * Notification keys: from env if set, otherwise generated once and kept in the
 * server-only app_secrets table (so there's nothing extra to configure).
 */
async function ensureVapid(): Promise<string> {
  if (vapidPublic) return vapidPublic;
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const { data } = await db().from('app_secrets').select('key, value').in('key', ['vapid_public', 'vapid_private']);
    pub = data?.find((r) => r.key === 'vapid_public')?.value;
    priv = data?.find((r) => r.key === 'vapid_private')?.value;
    if (!pub || !priv) {
      const keys = webpush.generateVAPIDKeys();
      // ignoreDuplicates: if two server instances race, the first write wins and we re-read it
      await db().from('app_secrets').upsert(
        [
          { key: 'vapid_public', value: keys.publicKey },
          { key: 'vapid_private', value: keys.privateKey },
        ],
        { onConflict: 'key', ignoreDuplicates: true },
      );
      const { data: again } = await db().from('app_secrets').select('key, value').in('key', ['vapid_public', 'vapid_private']);
      pub = again?.find((r) => r.key === 'vapid_public')?.value;
      priv = again?.find((r) => r.key === 'vapid_private')?.value;
    }
  }
  if (!pub || !priv) throw new Error('Could not set up notification keys');
  webpush.setVapidDetails(APP_URL.startsWith('https://') ? APP_URL : 'mailto:notifications@rep.invalid', pub, priv);
  vapidPublic = pub;
  return pub;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Send one notification to every device these people have turned notifications on for. Returns how many went out. */
export async function pushToUsers(userIds: string[], message: PushMessage, ttlSeconds = 60 * 60 * 12): Promise<number> {
  if (!userIds.length) return 0;
  await ensureVapid();
  const { data: subs } = await db().from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: ttlSeconds });
      sent++;
    } catch (err: any) {
      // 404/410 = that phone unsubscribed or reinstalled; tidy it up
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db().from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        console.error('push failed', err?.statusCode, err?.body);
      }
    }
  }
  return sent;
}

const ActivityBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(10) });

export function mountPushRoutes(app: Express) {
  app.get('/push/public-key', async (_req: Request, res: Response) => {
    if (!pushConfigured()) return void res.status(503).json({ error: 'Notifications not configured' });
    try {
      res.json({ publicKey: await ensureVapid() });
    } catch (e) {
      console.error('VAPID setup failed', e);
      res.status(500).json({ error: 'Notifications unavailable' });
    }
  });

  app.post('/push/activity', async (req: Request, res: Response) => {
    if (!pushConfigured()) return void res.status(503).json({ error: 'Notifications not configured' });
    const parsed = ActivityBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
    const user = await userFromRequest(req);
    if (!user) return void res.status(401).json({ error: 'Sign in again' });

    try {
      await ensureVapid();
      // Only the author's own, recent feed items — stops anyone replaying old ones to spam friends.
      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data: items } = await db()
        .from('activity')
        .select('id, challenge_id, user_id, kind, payload, challenges(name)')
        .in('id', parsed.data.ids)
        .eq('user_id', user.id)
        .gte('created_at', since);
      if (!items?.length) return void res.json({ sent: 0 });

      const { data: me } = await db().from('profiles').select('username, display_name').eq('id', user.id).single();
      const name = me?.display_name || (me?.username ? `@${me.username}` : 'A friend');

      let sent = 0;
      for (const it of items as any[]) {
        let recipients: string[];
        if (it.kind === 'nudge' && it.payload?.to) {
          recipients = [it.payload.to];
        } else {
          const { data: members } = await db().from('challenge_members').select('user_id').eq('challenge_id', it.challenge_id);
          recipients = (members ?? []).map((m) => m.user_id);
        }
        recipients = recipients.filter((u) => u !== user.id);
        if (!recipients.length) continue;

        const challengeName = it.challenges?.name ?? 'your challenge';
        const message =
          it.kind === 'workout'
            ? { title: `${name} just ${it.payload?.logged ? 'logged' : 'finished'} a workout 💪`, body: `${it.payload?.title ?? 'Workout'} · ${challengeName}. Your turn?` }
            : it.kind === 'nudge'
              ? { title: `${name} nudged you 👋`, body: `Time to move! · ${challengeName}` }
              : null;
        if (!message) continue;

        sent += await pushToUsers(recipients, { ...message, url: `/challenge/${it.challenge_id}`, tag: `act-${it.id}` });
      }
      res.json({ sent });
    } catch (e) {
      console.error('push/activity failed', e);
      res.status(500).json({ error: 'Could not send notifications' });
    }
  });
}
