// Rate limits.
//  • Per-IP request limit on every route (in memory — resets on restart, fine for burst protection).
//  • Per-person daily AI coach limits (in the database, so they survive restarts and multiple instances).
//  • Legacy coach-password callers have no identity, so they get per-IP daily limits in memory.
import type { NextFunction, Request, Response } from 'express';
import { db } from './supabase.js';

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const LIMITS = {
  perMinutePerIp: num(process.env.RATE_LIMIT_PER_MINUTE, 120),
  dailyChats: num(process.env.COACH_DAILY_CHATS, 30),
  dailyPlans: num(process.env.COACH_DAILY_PLANS, 5),
};

/** Seconds until the daily counters reset (midnight UTC). */
export function secondsUntilReset(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

// ── per-IP, per-minute ──
const windows = new Map<string, { start: number; n: number }>();
export function ipRateLimit(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next();
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    windows.set(key, { start: now, n: 1 });
    if (windows.size > 10_000) windows.clear(); // never grow without bound
    return next();
  }
  if (++w.n > LIMITS.perMinutePerIp) {
    const retry = Math.ceil((w.start + 60_000 - now) / 1000);
    res.setHeader('Retry-After', String(retry));
    return void res.status(429).json({ error: 'Too many requests — try again in a minute.', code: 'rate_limited' });
  }
  next();
}

export type CoachKind = 'chat' | 'plan';
const limitFor = (kind: CoachKind) => (kind === 'chat' ? LIMITS.dailyChats : LIMITS.dailyPlans);

/** Count one coach use for a signed-in person. Returns false when today's limit is reached. */
export async function takeUserQuota(userId: string, kind: CoachKind): Promise<boolean> {
  const { data, error } = await db().rpc('bump_coach_usage', { p_user: userId, p_kind: kind, p_limit: limitFor(kind) });
  if (error) throw new Error(`usage counter failed: ${error.message}`);
  return data !== null;
}

// ── legacy coach-password callers: per-IP daily counters in memory ──
const legacy = new Map<string, { day: string; chat: number; plan: number }>();
export function takeLegacyQuota(ip: string, kind: CoachKind): boolean {
  const day = new Date().toISOString().slice(0, 10);
  let e = legacy.get(ip);
  if (!e || e.day !== day) {
    e = { day, chat: 0, plan: 0 };
    legacy.set(ip, e);
  }
  if (e[kind] >= limitFor(kind)) return false;
  e[kind]++;
  return true;
}

export function sendDailyLimit(res: Response, kind: CoachKind) {
  res.setHeader('Retry-After', String(secondsUntilReset()));
  res.status(429).json({
    code: 'daily_limit',
    error:
      kind === 'chat'
        ? `You've used today's ${LIMITS.dailyChats} coach messages — back tomorrow.`
        : `You've built ${LIMITS.dailyPlans} plan${LIMITS.dailyPlans === 1 ? '' : 's'} today — back tomorrow.`,
  });
}
