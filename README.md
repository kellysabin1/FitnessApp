# rep.

New here? Plain-English guide: [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) · Technical architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Backlog: [docs/BACKLOG.md](docs/BACKLOG.md)

A moody workout tracker in bone, espresso, burnt olive and oxide with a built-in AI personal trainer.

| Today | Train | Progress | Coach |
|---|---|---|---|
| ![](docs/screenshots/1-today.png) | ![](docs/screenshots/2-train.png) | ![](docs/screenshots/3-progress.png) | ![](docs/screenshots/4-coach.png) |

## What's in v1

- **Workout logging**: exercises, sets, reps and weight (or minutes/distance for cardio, seconds for holds). There are 90+ built-in exercises across strength, Pilates, mobility and cardio, plus custom ones. Last session's numbers prefill so you can see what to beat. Includes quick-start templates, a session timer, a "how did it feel" rating, history, and estimated 1RM personal records.
- **Body & goals**: goals, height, goal weight, weigh-ins, body fat, waist and hips, a weight trend chart with your goal line, and lb/ft-in ⇄ kg/cm switching.
- **Health data**:
  - **Apple Health**: steps, sleep, resting HR, HRV, active calories and weigh-ins.
  - **RingConn**: comes in through Apple Health. In the RingConn app, turn on Apple Health sync.
  - **Oura**: readiness, sleep score, HRV and steps, through Oura's official API.
- **AI coach (Claude)**: a weekly plan (focus, 3–4 recommendations with specific exercises, a step goal you can apply with one tap, and recovery advice) plus a chat that knows your goals, lifts and recovery data.

Everything is stored on your phone. The only things that leave it are what's sent to your own coach server when you use the AI coach, and the Oura sign-in.

## Friends & challenges

- **Accounts** (email + password) with an @username; signing in also backs up your workouts.
- **Friends**: search by @username, send/accept requests.
- **Two kinds of challenge**: *Any workout* (everything members log counts; an optional shared plan earns
  bonus points) or *Group plan* (only the plan's workouts count). Plans can use routines or custom workouts.
- **Challenges**: pick a length, what earns points (workouts, daily steps, streaks, a shared group plan),
  invite by link/code or add friends directly. Leaderboard, activity feed with reactions, and nudges.
- **Notifications** when a friend finishes a workout or nudges you — Web Push from the home-screen app
  (iPhone iOS 16.4+), no Apple Developer account needed.

Scoring: workout +10 (max 2 a day) · 1,000 steps +1 (max 20 a day) and +5 on step-goal days ·
+3 for each active day that follows another · +5 for each group-plan workout.

Privacy: people only see your workouts and steps when you're in a challenge together, and only from
inside that challenge's dates. Everything is
enforced in the database (`supabase/schema.sql`); `supabase/rls_test.sql` checks it.

### Friends & challenges setup

1. Create a Supabase project. In **Authentication → Providers → Email**, turn **Confirm email** off.
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` → **Run**. It's safe to re-run, and
   re-running it is also how you apply updates.
3. Render → **rep-coach** → Environment: add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret) and
   `APP_URL` (your rep-app address).
4. The Supabase URL, publishable key and notification server address are public and built into
   `src/config.ts` — rep-app needs no extra settings.

## Project layout

```
app/                 screens (Expo Router)
  (tabs)/            Today, Train, Progress, Coach, You
  workout/[id].tsx   the live workout logger
src/
  store.ts           all app data (saved on device)
  coach.ts           builds the snapshot the AI coach reads
  health/            Apple Health, Oura, sync
  components/        UI kit + charts
  theme.ts           colours & fonts
server/              tiny Node server: AI coach, Oura sign-in, friend notifications
supabase/            database schema + privacy tests for friends & challenges
assets/textures/     croc.jpg, tortoise.jpg, satin.jpg (replace any file to change that card texture)
```

## Setup

### 1. Run the coach server

The app never contains your API keys. They live on a small server you control.

```bash
cd server
npm install
cp .env.example .env    # then fill in ANTHROPIC_API_KEY and APP_TOKEN
npm run dev
```

- Get an Anthropic API key at console.anthropic.com.
- `APP_TOKEN` is any long random password. You'll type the same value into the app.
- To host it, any Node host works (Render, Railway, Fly.io). Use build command `npm install && npm run build`, start command `npm start`, root directory `server`, and set the same env variables there.

### 2. Run the app

```bash
npm install
npx expo start
```

Then in the app go to **You → Coach server** and enter the server URL and app password.

### 3. Put it on your iPhone (Apple Health needs a real build)

Apple Health and Oura sign-in don't work in Expo Go or the browser preview. You need a development build:

- **With a Mac + Xcode:** `npx expo run:ios --device` installs it for free with your Apple ID. Apple makes you reinstall every 7 days.
- **Without a Mac:** use `npx eas-cli@latest build --profile development --platform ios` (needs the $99/yr Apple Developer account).

### 4. (Optional) Connect Oura

1. Create an app at cloud.ouraring.com → *API Applications*. Redirect URI: `rep://oura`.
2. Put the client ID and secret in `server/.env` (`OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`).
3. Create `.env` in the project root with `EXPO_PUBLIC_OURA_CLIENT_ID=<same client id>` and rebuild the app.
4. In the app: **You → Oura → Connect**.

## Status

- Typechecks clean. Every screen was clicked through in a phone-sized browser preview.
- The coach server was tested locally: password check, error handling, and a live call that reached Anthropic.
- **Not yet tested on a real iPhone**: Apple Health reads, Oura sign-in, and Oura data (written against Oura's v2 API docs). Expect a round of fixes on first device run.
