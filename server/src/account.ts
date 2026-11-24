// Account deletion (REP-5). Deleting the login (auth user) cascades through every table in Supabase
// (profile, workouts, body log, steps, friends, challenges they created, feed, reactions, reminders,
// consents, push subscriptions…). The person re-enters their password first.
import { createClient } from '@supabase/supabase-js';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';

import { db, supabaseConfigured, userFromRequest } from './supabase.js';

const Body = z.object({ password: z.string().min(1).max(200) });

// at most 5 password tries an hour per account
const tries = new Map<string, { hour: number; n: number }>();
const allowTry = (id: string) => {
  const hour = Math.floor(Date.now() / 3_600_000);
  const t = tries.get(id);
  if (!t || t.hour !== hour) {
    if (tries.size > 5000) tries.clear();
    tries.set(id, { hour, n: 1 });
    return true;
  }
  return ++t.n <= 5;
};

/** Check a password without touching anyone's session: a throwaway client that keeps nothing. */
async function passwordOk(email: string, password: string) {
  const c = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (data.session) await c.auth.admin.signOut(data.session.access_token).catch(() => {});
  return !error && !!data.user;
}

export function mountAccountRoutes(app: Express) {
  app.post('/account/delete', async (req: Request, res: Response) => {
    if (!supabaseConfigured()) return void res.status(503).json({ error: 'Not configured' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
    const user = await userFromRequest(req);
    if (!user?.email) return void res.status(401).json({ error: 'Sign in again, then try once more.' });
    if (!allowTry(user.id)) return void res.status(429).json({ error: 'Too many tries — wait an hour and try again.' });
    if (!(await passwordOk(user.email, parsed.data.password))) return void res.status(403).json({ error: 'That password isn’t right.' });

    try {
      const { error: e1 } = await db().rpc('delete_account_data', { p_user: user.id });
      if (e1) throw new Error(e1.message);
      // signs them out everywhere: refresh tokens go with the user
      const { error: e2 } = await db().auth.admin.deleteUser(user.id);
      if (e2) throw new Error(e2.message);
      res.json({ deleted: true });
    } catch (e) {
      console.error('account deletion failed', (e as Error).message);
      res.status(500).json({ error: 'Couldn’t delete your account just now — it’s still there. Please try again.' });
    }
  });
}
