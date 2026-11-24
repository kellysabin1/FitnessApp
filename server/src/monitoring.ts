// Error tracking & uptime alerts (REP-11), built on our own Supabase instead of a third-party service.
// Errors from the app (POST /errors) and from this server are scrubbed of personal data and stored in
// error_events (server-only table). The owner gets a push notification when new errors arrive (at most
// one an hour) and when the database's uptime check (supabase/jobs.sql) logged downtime.
import type { Express, Request, Response } from 'express';
import { z } from 'zod';

import { pushToUsers } from './push.js';
import { db, supabaseConfigured } from './supabase.js';

/**
 * Remove anything personal before storing: emails, tokens/keys, ids, and every number (weights, reps,
 * heart rate… are health data). What's left is the shape of the error, which is what debugging needs.
 */
export function scrub(text: string, max = 500): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]') // JWTs
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(sk|pk|sb|rk)[-_][\w-]{10,}/gi, '[key]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]')
    .replace(/\d+([.,]\d+)?/g, '#')
    .slice(0, max);
}

/** Stack traces: keep only "at fn (file:line:col)" style frames, scrubbed; drop everything else. */
const scrubStack = (stack?: string) =>
  stack
    ? stack
        .split('\n')
        .filter((l) => /^\s*at |@|\.js|\.ts/.test(l))
        .slice(0, 15)
        .map((l) =>
          l
            .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
            .replace(/\?[^\s):]*/g, '')
            .trim(),
        )
        .join('\n')
        .slice(0, 4000)
    : null;

/** Routes: strip query strings and ids, e.g. /challenge/3f2a…?x=1 → /challenge/:id */
const scrubRoute = (r?: string) =>
  r
    ? r
        .split('?')[0]
        .replace(/\/[0-9a-z]{10,}(?=\/|$)/gi, '/:id')
        .replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:id')
        .slice(0, 200)
    : null;

let lastErrorAlert = 0;

export async function recordError(
  source: 'app' | 'server',
  kind: string,
  message: string,
  extra: { stack?: string; route?: string; release?: string } = {},
) {
  if (!supabaseConfigured()) return;
  try {
    await db()
      .from('error_events')
      .insert({
        source,
        kind: scrub(kind, 60) || 'Error',
        message: scrub(message) || '(no message)',
        detail: scrubStack(extra.stack),
        route: scrubRoute(extra.route),
        release: extra.release?.slice(0, 40) ?? null,
      });
    void alertOwnerAboutErrors();
  } catch (e) {
    console.error('could not record error', (e as Error).message);
  }
}

async function ownerIds(): Promise<string[]> {
  const { data } = await db().from('app_secrets').select('value').eq('key', 'owner_user_ids').maybeSingle();
  return (data?.value ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
}

/** At most one "new errors" push an hour. */
async function alertOwnerAboutErrors() {
  if (Date.now() - lastErrorAlert < 60 * 60_000) return;
  lastErrorAlert = Date.now();
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await db().from('error_events').select('id', { count: 'exact', head: true }).neq('source', 'uptime').gte('at', since);
  const owners = await ownerIds();
  if (!owners.length || !count) return;
  await pushToUsers(owners, {
    title: `rep. logged ${count} error${count === 1 ? '' : 's'} in the last hour`,
    body: 'Details are in Supabase → Table editor → error_events.',
    url: '/',
    tag: 'owner-errors',
  });
}

/** Called on every reminder run (every 15 min): tell the owner if the uptime check saw downtime since last time. */
export async function alertOwnerAboutDowntime() {
  if (!supabaseConfigured()) return;
  try {
    const { data: mark } = await db().from('app_secrets').select('value').eq('key', 'uptime_alerted_until').maybeSingle();
    const since = mark?.value ?? new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: downs } = await db().from('error_events').select('at').eq('source', 'uptime').gt('at', since).order('at');
    if (!downs?.length) return;
    const last = downs[downs.length - 1].at as string;
    await db().from('app_secrets').upsert({ key: 'uptime_alerted_until', value: last });
    const owners = await ownerIds();
    if (!owners.length) return;
    const fmt = (iso: string) => new Date(iso).toISOString().slice(11, 16) + ' UTC';
    await pushToUsers(owners, {
      title: 'rep-coach was unreachable',
      body: `${downs.length} failed health check${downs.length === 1 ? '' : 's'} (${fmt(downs[0].at)}–${fmt(last)}). It's answering again now.`,
      url: '/',
      tag: 'owner-uptime',
    });
  } catch (e) {
    console.error('downtime alert failed', (e as Error).message);
  }
}

const AppError = z.object({
  kind: z.string().max(200),
  message: z.string().max(2000),
  stack: z.string().max(20_000).optional(),
  route: z.string().max(500).optional(),
  release: z.string().max(40).optional(),
});

// app error reports: no login needed (crashes can happen signed out), so keep a tight per-IP budget
const budget = new Map<string, { hour: number; n: number }>();
const allow = (ip: string) => {
  const hour = Math.floor(Date.now() / 3_600_000);
  const b = budget.get(ip);
  if (!b || b.hour !== hour) {
    if (budget.size > 5000) budget.clear();
    budget.set(ip, { hour, n: 1 });
    return true;
  }
  return ++b.n <= 20;
};

export function mountMonitoringRoutes(app: Express) {
  app.post('/errors', async (req: Request, res: Response) => {
    const parsed = AppError.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
    if (!allow(req.ip ?? 'unknown')) return void res.status(429).json({ error: 'Too many reports' });
    await recordError('app', parsed.data.kind, parsed.data.message, parsed.data);
    res.sendStatus(204);
  });
}

/** Last-resort handlers so crashes are logged (scrubbed) instead of vanishing. */
export function watchProcess() {
  process.on('unhandledRejection', (e) => {
    console.error('unhandled rejection', e);
    void recordError('server', 'UnhandledRejection', String((e as Error)?.message ?? e), { stack: (e as Error)?.stack });
  });
  process.on('uncaughtException', (e) => {
    console.error('uncaught exception', e);
    void recordError('server', e.name || 'Error', e.message, { stack: e.stack }).finally(() => process.exit(1));
  });
}
