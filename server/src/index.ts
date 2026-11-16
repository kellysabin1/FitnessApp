// Velour coach server.
// Holds the secrets the phone app must never contain: your Anthropic API key and
// your Oura client secret. The app talks to this server with a shared APP_TOKEN.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 8787);
const APP_TOKEN = process.env.APP_TOKEN ?? '';
const MODEL = process.env.COACH_MODEL ?? 'claude-opus-5-5';
const OURA_CLIENT_ID = process.env.OURA_CLIENT_ID ?? '';
const OURA_CLIENT_SECRET = process.env.OURA_CLIENT_SECRET ?? '';

if (!APP_TOKEN) {
  console.error('APP_TOKEN is required — set it to a long random password.');
  process.exit(1);
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const app = express();
app.use(express.json({ limit: '1mb' }));

// Allow the web preview (Expo web) to call us. The bearer token is the real gate.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function requireToken(req: Request, res: Response, next: NextFunction) {
  const got = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(APP_TOKEN);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return void res.status(401).json({ error: 'Wrong app password — check You → Coach server.' });
  }
  next();
}
app.use(requireToken);

// ---------------- Coach ----------------

const COACH_PERSONA = `You are Velour's personal trainer: a warm, encouraging, but direct coach — think a knowledgeable best friend who is also a certified strength & conditioning coach and Pilates instructor.

How you coach:
- Ground every recommendation in the client's data below (goals, recent workouts, weights lifted, weigh-ins, steps, sleep, HRV, readiness). Cite specific numbers when they matter ("your hip thrust went from 135 to 155 lb in three weeks").
- Cover strength training, Pilates, mobility/yoga, cardio (steps, Zone 2, HIIT), and fat loss / recomposition.
- Progressive overload: suggest concrete next targets (weight × reps, sets, or minutes).
- Recovery-aware: if sleep is short, HRV is down, or readiness is low, scale intensity down and say why.
- Step goals: suggest realistic increases (roughly +500 to +1,500 over the recent average), never a huge jump.
- Respect injuries, equipment and preferences in the profile. Never recommend exercises they said they dislike or that conflict with an injury.
- Hold them accountable kindly but firmly — if they've missed sessions, say so and give a simple plan to get back on track.

Safety:
- You are not a doctor or dietitian. For pain, injury, medical conditions, pregnancy, or disordered-eating signals, recommend seeing a professional and keep advice conservative.
- Never recommend extreme calorie deficits, crash diets, or training through sharp pain.

Style:
- The app shows plain text, so do not use Markdown headings, tables, bold or asterisks. Short paragraphs and simple "-" bullet lines are fine.
- Be concise: usually under 180 words unless they ask for a full program.
- Use the units stated in the data.`;

const ChatBody = z.object({
  context: z.string().max(60_000),
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(40)
    .default([]),
});

app.post('/coach/chat', async (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
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

const Plan = z.object({
  headline: z.string().describe('A short, motivating headline for this week, max ~8 words.'),
  focus: z.string().describe('1–2 sentences: what to focus on this week and why, referencing their data.'),
  stepGoal: z.number().int().describe('Recommended daily step goal.'),
  recommendations: z
    .array(
      z.object({
        title: z.string().describe('Short title, e.g. "Add a second glute day"'),
        why: z.string().describe('1–2 sentences explaining why, tied to their goals/data, with concrete targets.'),
        exercises: z.array(z.string()).describe('Specific exercises with sets×reps or duration, e.g. "Hip Thrust 4×8 @ 160 lb". Empty if not applicable.'),
      }),
    )
    .describe('3 to 4 recommendations spanning training, new exercises to rotate in, and daily movement.'),
  recovery: z.string().describe('1–2 sentences of recovery guidance based on sleep/HRV/readiness.'),
});

app.post('/coach/plan', async (req, res) => {
  const parsed = z.object({ context: z.string().max(60_000) }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Plan) },
      system: [
        { type: 'text', text: COACH_PERSONA, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `CLIENT DATA\n${parsed.data.context}` },
      ],
      messages: [
        {
          role: 'user',
          content:
            'Build my plan for this week: what to focus on, 3–4 specific recommendations (including new exercises to rotate in that fit my goals and equipment), a daily step goal, and recovery guidance. Plain text in each field, no markdown.',
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return void res.status(502).json({ error: 'The coach couldn’t build a plan right now — try again.' });
    }
    res.json(response.parsed_output);
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
    return void res.status(502).json({ error: 'Coach is temporarily unavailable.' });
  }
  console.error(e);
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

app.post('/oura/token', async (req, res) => {
  const p = z.object({ code: z.string(), redirectUri: z.string() }).safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    res.json(await ouraToken({ grant_type: 'authorization_code', code: p.data.code, redirect_uri: p.data.redirectUri }));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.post('/oura/refresh', async (req, res) => {
  const p = z.object({ refreshToken: z.string() }).safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'Bad request' });
  try {
    res.json(await ouraToken({ grant_type: 'refresh_token', refresh_token: p.data.refreshToken }));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => console.log(`Velour coach listening on :${PORT} (model ${MODEL})`));
