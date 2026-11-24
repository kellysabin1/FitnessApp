// rep. coach server.
// Holds the secrets the phone app must never contain: your Anthropic API key, the Supabase
// service key and your Oura client secret.
// Coach access: a signed-in rep. user whose profile has coach_enabled = true (per-person, revocable).
// Legacy: the shared APP_TOKEN works only if ALLOW_APP_TOKEN=true (retired — accounts are required now).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { mountPushRoutes } from './push.js';
import { mountReminderRoutes } from './reminders.js';
import { mountMonitoringRoutes, recordError, watchProcess } from './monitoring.js';
import { mountAccountRoutes } from './account.js';
import { ipRateLimit, LIMITS, sendDailyLimit, takeLegacyQuota, takeUserQuota, type CoachKind } from './limits.js';
import { db, supabaseConfigured, userFromRequest } from './supabase.js';

const PORT = Number(process.env.PORT ?? 8787);
const APP_TOKEN = process.env.APP_TOKEN ?? '';
const APP_URL_FOR_CORS = (process.env.APP_URL ?? '').trim();
// The old shared coach password has no person behind it (no consent, no per-person limits), so it's off
// unless explicitly re-enabled with ALLOW_APP_TOKEN=true.
const ALLOW_APP_TOKEN = !!APP_TOKEN && process.env.ALLOW_APP_TOKEN === 'true';
/** Bump when the AI-coach consent wording changes materially; people are asked again. Keep in step with src/consent.ts. */
const AI_CONSENT_VERSION = 1;
const MODEL = process.env.COACH_MODEL ?? 'claude-opus-5-5';
const OURA_CLIENT_ID = process.env.OURA_CLIENT_ID ?? '';
const OURA_CLIENT_SECRET = process.env.OURA_CLIENT_SECRET ?? '';

if (!ALLOW_APP_TOKEN && !supabaseConfigured()) {
  console.error('Nothing can reach the coach: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or APP_TOKEN).');
  process.exit(1);
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const app = express();
app.set('trust proxy', 1); // Render sits in front of us; use the real client IP for rate limits
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// CORS: only the rep. web app (APP_URL, plus ALLOWED_ORIGINS if set) and local development may call
// this server from a browser. Requests without an Origin (the reminder job, curl) aren't affected —
// the login token is still the real gate; this just stops other websites from using a visitor's session.
const ALLOWED_ORIGINS = new Set(
  [APP_URL_FOR_CORS, ...(process.env.ALLOWED_ORIGINS ?? '').split(',')].map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
);
const isLocalDev = (o: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
// rep.'s own Render static site, whatever suffix Render gave it — so a missing/mistyped APP_URL can't lock the app out
const isRepApp = (o: string) => /^https:\/\/rep-app(-[a-z0-9]+)?\.onrender\.com$/.test(o);
console.log(`CORS: allowing ${[...ALLOWED_ORIGINS, 'rep-app*.onrender.com', 'localhost'].join(', ')}`);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store'); // responses can contain personal data
  res.setHeader('Vary', 'Origin');
  const origin = req.headers.origin;
  if (origin) {
    const ok = ALLOWED_ORIGINS.has(origin) || isRepApp(origin) || isLocalDev(origin);
    if (!ok) return void res.status(403).json({ error: 'Origin not allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});

app.use(ipRateLimit);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Friend notifications use the person's rep. login instead of the coach password.
mountPushRoutes(app);
mountReminderRoutes(app);
mountMonitoringRoutes(app);
mountAccountRoutes(app);
watchProcess();

// ---------------- Who is calling? ----------------

type Caller = { kind: 'user'; userId: string } | { kind: 'legacy' };

function legacyTokenMatches(req: Request) {
  if (!ALLOW_APP_TOKEN) return false;
  const got = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(APP_TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Legacy coach password, or any signed-in rep. user. (Oura sign-in, connection check.) */
async function requireAppOrUser(req: Request, res: Response, next: NextFunction) {
  if (legacyTokenMatches(req)) return next();
  if (await userFromRequest(req)) return next();
  res.status(401).json({ error: 'Sign in again (or check the coach password).', code: 'signed_out' });
}

/** Coach routes: a signed-in user with coach access, or the legacy coach password. */
async function requireCoach(req: Request, res: Response, next: NextFunction) {
  if (legacyTokenMatches(req)) {
    res.locals.caller = { kind: 'legacy' } satisfies Caller;
    return next();
  }
  const user = await userFromRequest(req);
  if (!user) return void res.status(401).json({ error: 'Sign in to use the coach.', code: 'signed_out' });
  const { data } = await db().from('profiles').select('coach_enabled').eq('id', user.id).maybeSingle();
  if (!data?.coach_enabled) {
    return void res.status(403).json({ error: 'Your account doesn’t have coach access yet.', code: 'no_access' });
  }
  // The person must have agreed (in the app) to their data being sent to Anthropic — checked here too,
  // not just in the app. Latest answer wins, so withdrawing consent switches the coach off.
  const { data: consent } = await db()
    .from('consents')
    .select('granted, version')
    .eq('user_id', user.id)
    .eq('kind', 'ai_coach')
    .order('at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!consent?.granted || consent.version < AI_CONSENT_VERSION) {
    return void res
      .status(403)
      .json({ error: 'Allow the AI coach first — open the Coach tab to see what it uses.', code: 'needs_consent' });
  }
  res.locals.caller = { kind: 'user', userId: user.id } satisfies Caller;
  next();
}

/** Count one use against today's limit; sends the 429 itself and returns false when over. */
async function takeQuota(req: Request, res: Response, kind: CoachKind) {
  const caller = res.locals.caller as Caller;
  const ok = caller.kind === 'user' ? await takeUserQuota(caller.userId, kind) : takeLegacyQuota(req.ip ?? 'unknown', kind);
  if (!ok) sendDailyLimit(res, kind);
  return ok;
}

// Lets the app confirm the URL + password are right ("Save & test").
app.get('/auth-check', requireAppOrUser, (_req, res) => {
  res.json({ ok: true });
});

// Lets a signed-in app know whether to show the coach or "ask for access".
app.get('/coach/access', async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return void res.status(401).json({ error: 'Sign in again.', code: 'signed_out' });
  const { data } = await db().from('profiles').select('coach_enabled').eq('id', user.id).maybeSingle();
  res.json({ enabled: !!data?.coach_enabled, limits: { chats: LIMITS.dailyChats, plans: LIMITS.dailyPlans } });
});

// ---------------- Coach ----------------

const COACH_PERSONA = `You are the personal trainer inside rep., a workout app. You are a calm, confident, direct coach — a certified strength & conditioning coach who also knows Pilates, mobility and endurance training. You speak like an experienced professional: clear, specific and encouraging without hype. No slang, no cheerleading, no cutesy or gendered language; the app is used by people of every gender and age.

How you coach:
- Ground every recommendation in the client's data below (goals, recent workouts, weights lifted, weigh-ins, steps, sleep, HRV, readiness). Cite specific numbers when they matter ("your squat went from 135 to 155 lb in three weeks").
- Cover strength training, Pilates, mobility/yoga, cardio (steps, Zone 2, HIIT), and fat loss / recomposition.
- Progressive overload: suggest concrete next targets (weight × reps, sets, or minutes).
- Recovery-aware: if sleep is short, HRV is down, or readiness is low, scale intensity down and say why.
- Step goals: suggest realistic increases (roughly +500 to +1,500 over the recent average), never a huge jump.
- Respect injuries, equipment and preferences in the profile. Never recommend exercises they said they dislike or that conflict with an injury.
- Hold them accountable plainly and respectfully — if they've missed sessions, say so and give a simple plan to get back on track.

Safety:
- You are not a doctor or dietitian. For pain, injury, medical conditions, pregnancy, or disordered-eating signals, recommend seeing a professional and keep advice conservative.
- Never recommend extreme calorie deficits, crash diets, or training through sharp pain.

Style:
- The app shows plain text, so do not use Markdown headings, tables, bold or asterisks. Short paragraphs and simple "-" bullet lines are fine.
- Be concise: usually under 180 words unless they ask for a full program.
- Use the units stated in the data.
- If the client has goals but no specific targets, help them pick one: ask what they want to achieve and by when, and if they still haven't set one, suggest a realistic target with a timeframe.
- If the client follows a split, respect its rolling order (a missed day just moves the next workout to the following day).`;

const ChatBody = z.object({
  context: z.string().max(60_000),
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(40)
    .default([]),
});

app.post('/coach/chat', requireCoach, async (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    if (!(await takeQuota(req, res, 'chat'))) return;
  } catch (e) {
    return void handleError(e, res);
  }
  const { context, message, history } = parsed.data;

  // History must alternate and start with a user turn.
  const msgs: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    if (msgs.length === 0 && m.role !== 'user') continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role) continue;
    msgs.push({ role: m.role, content: m.content });
  }
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  msgs.push({ role: 'user', content: message });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: COACH_PERSONA, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `CLIENT DATA\n${context}` },
      ],
      messages: msgs,
    });
    if (response.stop_reason === 'refusal') {
      return void res.json({ reply: 'I can’t help with that one — try asking it a different way, or check with a professional.' });
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    res.json({ reply });
  } catch (e) {
    handleError(e, res);
  }
});

// ── Structured coach outputs (weekly plan, AI split, target plan) ──

const Exercise = z.object({
  name: z.string().describe('Exercise name. Prefer names from EXERCISE LIBRARY exactly as written; otherwise a clear standard name.'),
  sets: z.number().int().describe('Working sets, e.g. 3. Use 1 for cardio or holds.'),
  reps: z.string().describe('Reps or duration per set, e.g. "8-10", "12 each side", "30s", "20 min".'),
});

const SplitWorkoutOut = z.object({
  title: z.string().describe('Short workout name, e.g. "Lower A — strength" or "Upper body".'),
  focus: z.string().describe('One short sentence on what this session is for.'),
  exercises: z.array(Exercise).describe('4–7 exercises in the order to do them.'),
});

const SuggestedTarget = z.object({
  kind: z.enum(['bodyweight', 'lift', 'run', 'steps', 'workouts', 'measurement', 'custom']),
  title: z.string().describe('Short, specific, e.g. "Lose 4 lb" or "Hip thrust 225 lb".'),
  exercise: z.string().nullable().describe('For lift targets: the exercise name; otherwise null.'),
  target_value: z
    .number()
    .describe('Target in the user’s units: lb or kg for weight/lifts, seconds for run times, steps/day, workouts/week.'),
  weeks: z.number().int().describe('Realistic timeframe in weeks.'),
  why: z.string().describe('One sentence: why this target fits their goals and data.'),
});

const Plan = z.object({
  headline: z.string().describe('A short headline for this week, max ~8 words. Calm and specific.'),
  focus: z.string().describe('1–2 sentences: what to focus on this week and why, referencing their data.'),
  stepGoal: z.number().int().describe('Recommended daily step goal.'),
  recommendations: z
    .array(
      z.object({
        title: z.string().describe('Short title, e.g. "Add a second lower-body day"'),
        why: z.string().describe('1–2 sentences explaining why, tied to their goals/data, with concrete targets.'),
        exercises: z.array(Exercise).describe('If this recommendation is a workout, its exercises (4–7). Empty if not a workout.'),
      }),
    )
    .describe('3 to 4 recommendations spanning training, new exercises to rotate in, and daily movement.'),
  recovery: z.string().describe('1–2 sentences of recovery guidance based on sleep/HRV/readiness.'),
  suggestedTargets: z
    .array(SuggestedTarget)
    .describe(
      'If the client has NO active targets: 1–2 suggested measurable targets that fit their goals. If they already have targets: empty array.',
    ),
});

const SplitOut = z.object({
  name: z.string().describe('Name of the split, e.g. "4-day upper / lower".'),
  notes: z
    .string()
    .describe('2–3 sentences: how to run it (rolling order — if a day is missed, just do the next workout), progression, and rest.'),
  workouts: z.array(SplitWorkoutOut).describe('The workouts in the order to do them. One per training day per week.'),
});

const TargetPlanOut = z.object({
  summary: z
    .string()
    .describe(
      '2–3 sentences: the approach and whether the target and timeframe are realistic (say so plainly if not, and suggest an adjustment).',
    ),
  weekly: z.array(z.string()).describe('One short line per week of the timeframe (max 12) describing that week’s focus/milestone.'),
  actions: z.array(z.string()).describe('3–6 concrete daily/weekly actions (training, steps, nutrition basics, sleep).'),
  stepGoal: z.number().int().nullable().describe('A daily step goal if relevant, else null.'),
  workouts: z.array(SplitWorkoutOut).describe('0–4 workouts that directly serve this target (empty if not training-related).'),
});

async function structured<T extends z.ZodType>(res: Response, schema: T, context: string, instruction: string, failMsg: string) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
    system: [
      { type: 'text', text: COACH_PERSONA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `CLIENT DATA\n${context}` },
    ],
    messages: [{ role: 'user', content: `${instruction} Plain text in each field, no markdown.` }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    res.status(502).json({ error: failMsg });
    return;
  }
  res.json(response.parsed_output);
}

const ContextBody = z.object({ context: z.string().max(60_000), library: z.array(z.string().max(80)).max(400).optional() });
const withLibrary = (b: z.infer<typeof ContextBody>) =>
  b.library?.length ? `${b.context}\n## EXERCISE LIBRARY (prefer these names)\n${b.library.join(', ')}` : b.context;

app.post('/coach/plan', requireCoach, async (req, res) => {
  const parsed = ContextBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    if (!(await takeQuota(req, res, 'plan'))) return;
    await structured(
      res,
      Plan,
      withLibrary(parsed.data),
      'Build my plan for this week: what to focus on, 3–4 specific recommendations (workouts should list their exercises with sets and reps; include new exercises to rotate in that fit my goals and equipment), a daily step goal, recovery guidance, and — only if I have no active targets — 1–2 suggested targets.',
      'The coach couldn’t build a plan right now — try again.',
    );
  } catch (e) {
    handleError(e, res);
  }
});

const SplitBody = ContextBody.extend({
  daysPerWeek: z.number().int().min(1).max(7),
  request: z.string().max(500).optional(),
});

app.post('/coach/split', requireCoach, async (req, res) => {
  const parsed = SplitBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    if (!(await takeQuota(req, res, 'plan'))) return;
    await structured(
      res,
      SplitOut,
      withLibrary(parsed.data),
      `Design my workout split: exactly ${parsed.data.daysPerWeek} workouts per week, built around my goals, experience, equipment, injuries/preferences and active targets. ${
        parsed.data.request ? `My request: "${parsed.data.request}".` : ''
      } Balance the week, include progression guidance, and use exercises from the library where possible.`,
      'The coach couldn’t build a split right now — try again.',
    );
  } catch (e) {
    handleError(e, res);
  }
});

const TargetPlanBody = ContextBody.extend({ target: z.string().max(1000) });

app.post('/coach/target-plan', requireCoach, async (req, res) => {
  const parsed = TargetPlanBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    if (!(await takeQuota(req, res, 'plan'))) return;
    await structured(
      res,
      TargetPlanOut,
      withLibrary(parsed.data),
      `Make a plan for this target: ${parsed.data.target}. Week-by-week focus, concrete actions, a step goal if relevant, and any workouts that directly serve it. Be honest about whether it's realistic.`,
      'The coach couldn’t build a plan for this target right now — try again.',
    );
  } catch (e) {
    handleError(e, res);
  }
});

function handleError(e: unknown, res: Response) {
  if (e instanceof Anthropic.AuthenticationError) {
    console.error('Anthropic auth failed — check ANTHROPIC_API_KEY');
    return void res.status(500).json({ error: 'Coach server has an invalid Anthropic API key.' });
  }
  if (e instanceof Anthropic.RateLimitError) {
    return void res.status(429).json({ error: 'Coach is busy — try again in a minute.' });
  }
  if (e instanceof Anthropic.BadRequestError) {
    console.error('Bad request to Claude:', e.message);
    return void res.status(500).json({ error: 'Coach request was rejected — check the server logs.' });
  }
  if (e instanceof Anthropic.APIError) {
    console.error(`Claude API error ${e.status}:`, e.message);
    void recordError('server', `ClaudeAPIError${e.status ?? ''}`, e.message, { route: res.req?.path });
    return void res.status(502).json({ error: 'Coach is temporarily unavailable.' });
  }
  console.error(e);
  void recordError('server', (e as Error)?.name ?? 'Error', String((e as Error)?.message ?? e), {
    stack: (e as Error)?.stack,
    route: res.req?.path,
  });
  res.status(500).json({ error: 'Something went wrong on the coach server.' });
}

// ---------------- Oura OAuth (keeps the client secret off the phone) ----------------

async function ouraToken(params: Record<string, string>) {
  if (!OURA_CLIENT_ID || !OURA_CLIENT_SECRET) throw new Error('Oura is not configured on the server.');
  const r = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: OURA_CLIENT_ID, client_secret: OURA_CLIENT_SECRET }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Oura token exchange failed (${r.status})`);
  return json;
}

app.post('/oura/token', requireAppOrUser, async (req, res) => {
  const p = z.object({ code: z.string(), redirectUri: z.string() }).safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    res.json(await ouraToken({ grant_type: 'authorization_code', code: p.data.code, redirect_uri: p.data.redirectUri }));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.post('/oura/refresh', requireAppOrUser, async (req, res) => {
  const p = z.object({ refreshToken: z.string() }).safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    res.json(await ouraToken({ grant_type: 'refresh_token', refresh_token: p.data.refreshToken }));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => console.log(`rep. coach listening on :${PORT} (model ${MODEL})`));
