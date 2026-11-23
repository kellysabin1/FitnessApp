# rep. — technical architecture

Audience: developers, DevSecOps, technical PMs. Plain-English version: [HOW-IT-WORKS.md](HOW-IT-WORKS.md).

## 1. System overview

```
                        ┌──────────────────────────── GitHub: kellysabin1/FitnessApp (main) ───────────┐
                        │  app/ src/ public/ (client)   server/ (API)   supabase/ (DB schema + tests)  │
                        └───────────────┬───────────────────────────────┬──────────────────────────────┘
                              push → Render Blueprint (render.yaml) auto-deploy
                                        │                               │
          ┌─────────────────────────────▼───────┐       ┌───────────────▼──────────────────────────┐
 iPhone   │ rep-app  (Render Static Site)       │       │ rep-coach (Render Web Service, Node 22)  │
 Safari ──┤ Expo web export, SPA, PWA + SW      │──────▶│ Express 5 · TS→ESM                       │──▶ Anthropic API
 (PWA)    └─────────────────────────────────────┘ HTTPS │ /coach/* /oura/*  (bearer APP_TOKEN)     │    (Claude)
     │                                                  │ /push/*           (Supabase user JWT)    │──▶ Web Push services
     │  supabase-js (publishable key + user JWT)        └───────────────┬──────────────────────────┘    (APNs web / FCM)
     └──────────────────────────────▶ Supabase ◀────────────────────────┘ service-role key
                                      Postgres 15+ · GoTrue (auth) · PostgREST (auto REST) · RLS
```

Three runtime tiers, all managed SaaS, no servers we patch ourselves:

| Tier | Tech | Host | Plan |
|---|---|---|---|
| Client | Expo SDK 58 / React Native 0.88 / React 19.3, TypeScript 6 | Render Static Site (web/PWA). Native iOS build via EAS — not yet shipped | Free |
| API | Node 22, Express 5, TypeScript (tsc → ESM), Zod validation | Render Web Service `rep-coach` | Free (sleeps after 15 min idle → cold start ~30–60 s) |
| Data/Auth | Supabase: Postgres, GoTrue email/password auth, PostgREST | Supabase project `kkhpfyxrestlohjvpcit` | Free (project pauses after ~7 days of no activity) |
| AI | Anthropic Messages API, model `claude-opus-5-5` | Anthropic | Prepaid credit + spend limit |

## 2. Client

- **Framework:** Expo (managed workflow, Continuous Native Generation — no `ios/`/`android/` in the repo;
  native config lives in `app.json` + config plugins). One TypeScript codebase targets iOS and web via
  `react-native-web`.
- **Routing:** Expo Router, file-based (`app/`), typed routes. Tabs: Today, Train, Progress, Friends, Coach,
  You; modal routes for logging, account, challenge creation, invites (`/join/[code]` deep link).
- **State:** Zustand + `persist` middleware → AsyncStorage (IndexedDB/localStorage on web). Local-first:
  the device is the source of truth for the user's own data; canonical units are metric, converted at the
  view layer.
- **Web delivery:** `expo export --platform web` → static SPA (`output: "single"`), Render rewrite
  `/* → /index.html`. PWA bits in `public/`: `index.html` template (iOS standalone meta), `manifest.json`,
  icons, and `sw.js` (service worker for Web Push).
- **Native-only integrations (code complete, untested on device):**
  - Apple Health via `@kingstinct/react-native-healthkit` 16 (Nitro modules). RingConn data arrives
    through HealthKit — RingConn has no public API. Platform split via `appleHealth.ios.ts` / `appleHealth.ts`.
  - Oura API v2 via OAuth 2.0 authorization-code flow (`expo-auth-session`); token exchange/refresh is
    proxied through the server so the client secret never ships in the binary.
  - Both require a dev/production build (`eas.json` profiles exist; bundle ID `com.kellysabin.rep`), which
    requires an Apple Developer Program membership.

- **Training model (`src/training.ts`):** a *split* is an ordered list of workouts; "Up next" is the workout after
  the last finished one from that split (rolling — a missed day doesn't skip anything). A *target* stores start,
  target and dates in canonical units; current value is derived from logged data (body log, heaviest working set
  since the start date, 7-day step average, workouts this week) or manual check-ins (run times, custom). Pace =
  progress vs. a straight line from start to deadline.

## 3. API server (`server/`)

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | none | Render health check |
| `GET /push/public-key` | none | VAPID public key for subscriptions |
| `POST /push/activity` | Supabase user JWT (verified via `auth.getUser` with service-role client) | Fan out Web Push for feed items |
| `GET /coach/access` | Supabase user JWT | Whether this account has coach access + daily limits |
| `POST /coach/chat`, `POST /coach/plan`, `POST /coach/split`, `POST /coach/target-plan` | Supabase JWT **and** `profiles.coach_enabled` (legacy APP_TOKEN accepted until `ALLOW_APP_TOKEN=false`) | AI coach, with per-user daily quotas |
| `GET /reminders/status` | none | Whether push / email reminders can be sent |
| `POST /reminders/run` | shared key from `app_secrets` (`x-cron-key`) | Called every 15 min by Supabase `pg_cron` + `pg_net`; sends due reminders |
| `GET /auth-check`, `POST /oura/token`, `POST /oura/refresh` | Any signed-in user or legacy APP_TOKEN | Connection check, OAuth code/refresh exchange |

- **Per-user coach access (REP-1):** `profiles.coach_enabled` is protected with column-level privileges —
  users can only write `id`, `username`, `display_name`, so only the owner (dashboard/SQL) can grant access.
- **Rate limits (REP-2):** per-IP limit on all routes (`RATE_LIMIT_PER_MINUTE`, default 120, in memory);
  per-user daily coach quotas (`COACH_DAILY_CHATS` 30, `COACH_DAILY_PLANS` 5) counted atomically in
  Postgres (`bump_coach_usage`, server-only) so they survive restarts. Legacy APP_TOKEN callers get per-IP
  daily quotas. Over-limit → `429` + `Retry-After`. `trust proxy` set for Render.
- APP_TOKEN compared with `crypto.timingSafeEqual`. CORS `*` for now (REP-3 will restrict it).
- **AI integration:** official `@anthropic-ai/sdk`. Stateless — the client builds a compact plain-text
  context snapshot (profile, goals, last 12 workouts, e1RMs, 7-day wearable data) and sends it per request.
  System persona is prompt-cached (`cache_control: ephemeral`). Chat uses `effort: low`; the weekly plan
  uses `effort: medium` with **structured output** (Zod schema → `messages.parse`) so the UI gets typed
  JSON. The same pattern builds a split (`/coach/split`: days/week + optional request → named workouts with
  sets × reps, exercises chosen from the app's library) and a per-target plan (`/coach/target-plan`). Plan,
  split and target-plan share the daily `plan` quota. Server-side refusal fallback (`fallbacks: "default"`) is enabled; refusals are handled explicitly.
  Typed SDK errors map to user-safe messages (401→bad key, 429→busy, etc.).
- **Reminders (REP-21):** `reminder_settings` (owner-only: push/email flags, time, IANA time zone, rest
  day, last sent day). `due_reminders()` (service-role only) picks people whose local time is within 3 h
  after their reminder time, who haven't been reminded today, aren't on a rest day and have no workout with
  today's `local_day`; unknown time zones are skipped via `local_now()`. The schedule lives in the database
  (`supabase/reminders_cron.sql`: pg_cron every 15 min → pg_net POST), so it works while the free Render
  instance sleeps — the call wakes it. The server marks the day sent *before* sending (never twice), adds
  "Up next" from the active split, sends Web Push, and email via Resend when `RESEND_API_KEY` is set.
- **Push:** `web-push` (VAPID). Keys are generated on first use and stored in `app_secrets` (service-role
  only), so there's nothing to configure. Anti-abuse: caller must be the author, items must be < 10 min
  old, max 10 per call. Dead subscriptions (404/410) are pruned.

## 4. Data layer (Supabase)

**Auth:** GoTrue email/password; email confirmation currently **off** (free-tier SMTP is rate-limited).
The client uses the **publishable (anon) key** — safe to embed; all authorization is enforced by
Postgres Row-Level Security (RLS). The **service-role key** (bypasses RLS) exists only on `rep-coach`.

**Schema** (`supabase/schema.sql`, idempotent — re-running it is the migration mechanism):

| Table | Key points |
|---|---|
| `profiles` | `id` = `auth.users.id`; `username citext` unique, regex-checked |
| `friendships` | (requester, addressee) PK + unique index on the unordered pair; pending → accepted |
| `challenges` | dates, `mode` (`any`/`plan`), scoring flags, `step_goal`, `plan jsonb`, 6-char `invite_code` |
| `challenge_members` | membership; joins only via RPCs |
| `workouts` | PK (`user_id`, client-generated `id`); `local_day` (user's TZ), summary metrics + `exercises jsonb`, `plan_item` |
| `daily_steps` | PK (`user_id`, `day`) |
| `activity`, `reactions` | challenge feed; emoji whitelist |
| `push_subscriptions` | one row per device endpoint |
| `app_secrets` | RLS on, **no policies** → service-role only |

**RLS model (least privilege):**
- Own rows: full access. Profiles: readable by any signed-in user (needed for username search).
- Challenge-mates can read each other's `workouts`/`daily_steps` **only for days inside a challenge they
  share** (`shared_on_day(viewer, owner, day)`).
- Membership checks are `SECURITY DEFINER` functions with a pinned `search_path` (avoids RLS recursion
  and search-path hijacking). State-changing flows go through RPCs (`create_challenge`, `join_challenge`,
  `add_friend_to_challenge`) with `EXECUTE` revoked from `anon`/`public`.
- **Leaderboard** is computed server-side in SQL (`challenge_leaderboard`, CTE pipeline) so scoring can't
  be manipulated by the client.
- **Tests:** `supabase/rls_test.sql` — 53 assertions (cross-user write attempts, visibility, invite codes,
  scoring incl. plan-only mode and streaks, anon access). Run against local Postgres 16 with a mocked
  `auth.uid()`; also run as an upgrade test from the previous schema version.

**Accounts are required** (since v5): the welcome screen gates the app; sign-in restores everything. Private
account data lives in owner-only tables — `user_data` (profile, settings incl. active split, custom exercises,
`splits` and `targets` as JSON documents capped at ~300 KB each — v6). Workouts carry `split_id` /
`split_workout_id` (v7) so "Up next" survives a reinstall and `body_entries`
(body log; never visible to challenge-mates). Challenges can have up to 3 daily tasks (`challenges.tasks`,
check-offs in `task_checks`, +2 points each, today/yesterday only).

**Sync:** client-side, last-write-wins on `updatedAt` (profile/settings as one document; body entries and
workouts per row). Changes upload automatically ~4 s after they happen; sign-in pulls everything down first.
Signing in as a different person on the same phone starts clean; signing out backs up, then clears the phone.
Original notes: last-write-wins on `updatedAt`. On save: upsert workouts changed since
`lastSyncAt`, tombstones via a `pendingDeletes` queue, upsert 30 days of steps. On sign-in: pull and merge
(cloud restore). No realtime subscriptions — screens refetch on focus.

## 5. Configuration & secrets

| Name | Where | Secret? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Render `rep-coach` env | **Yes** |
| `APP_TOKEN` | Render `rep-coach` env (generated by Blueprint); entered in app | **Yes** (shared bearer) |
| `SUPABASE_SERVICE_ROLE_KEY` | Render `rep-coach` env | **Yes** (bypasses RLS) |
| `SUPABASE_URL`, `APP_URL` | Render `rep-coach` env | No |
| `RESEND_API_KEY`, `REMINDER_FROM` (optional) | Render `rep-coach` env — turns on email reminders | Key: **Yes** |
| Reminder job key | `app_secrets.reminder_cron_key` (generated in SQL; read by the job and the server) | **Yes** — never leaves the database/server |
| Supabase URL, publishable key, push server URL | `src/config.ts` (overridable via `EXPO_PUBLIC_*`) | No — designed to be public |

`.env` files are git-ignored; no secrets are committed. Infrastructure is declared in `render.yaml`
(Blueprint / IaC).

## 6. SDLC today

- Single `main` branch, direct pushes, Render auto-deploys on push. One environment (production).
- Quality gates run manually before each push: `tsc --noEmit` (app + server), Playwright end-to-end runs
  against the web build (onboarding, logging, past workouts, coach states, social screens), SQL RLS suite,
  `npm audit` (server clean; app: 3 moderate in `minimatch`, build-time only).
- Database changes are applied manually (paste `schema.sql` into the Supabase SQL editor).

## 7. Known gaps & recommendations (prioritized)

**Security / risk**
1. ~~Coach auth is a shared bearer secret~~ — done (REP-1); retire APP_TOKEN with `ALLOW_APP_TOKEN=false`.
2. ~~No rate limiting~~ — done (REP-2).
3. **Email confirmation off; no CAPTCHA** → unverified sign-ups. → Custom SMTP + confirmation, or Supabase CAPTCHA.
4. **Health data.** Coach requests send health metrics to Anthropic; the app stores consumer health data.
   Likely not HIPAA-covered, but consumer-health privacy laws (e.g. Washington's My Health My Data Act)
   apply. → Privacy policy, terms, consent copy, data-deletion flow before any public launch.
5. **Third-party imagery** (Pinterest-inspired textures are generated, but any original photos added
   later need licenses).

**Engineering hygiene**
6. **No CI.** → GitHub Actions running typecheck, lint, Playwright and the RLS suite on PRs; branch
   protection on `main`.
7. **Playwright scripts aren't committed** yet. → Move them into `e2e/` and run in CI.
8. **No linter configured** (`expo lint` not set up). → Add ESLint.
9. **Single environment.** → Add a staging Supabase project + Render preview environments.
10. **No observability** beyond Render logs. → Error tracking (e.g. Sentry) for app and server.
11. **Free-tier limits:** Render cold starts; Supabase pauses idle projects and has limited backups. →
    Paid tiers ($7/mo Render, $25/mo Supabase incl. daily backups) before real users depend on it.
12. **Migrations are manual.** → Supabase CLI migrations applied in CI.

**Product dependencies**
13. Apple Developer Program ($99/yr) blocks: native build, HealthKit/RingConn, Oura, App Store. Native
    integrations are code-complete but **unverified on device**.
