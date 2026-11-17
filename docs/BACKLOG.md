# rep. — backlog

Two parts: **Part 1 — Hardening** (security, compliance, delivery; REP-1…12) and
**Part 2 — Product** (features from the product owner's list; REP-13…29, drafts awaiting detail).

# Part 1 — Hardening

Source: risks in [ARCHITECTURE.md §7](ARCHITECTURE.md#7-known-gaps--recommendations-prioritized).
Sizes: **S** ≤ ½ day · **M** 1–2 days · **L** 3–5 days. Priority: **P0** before inviting anyone beyond
close friends · **P1** before a public/beta launch · **P2** soon after.

Suggested order: REP-1 → REP-2 → REP-3 → REP-6 → REP-4 → REP-5 → REP-7 → REP-8 → REP-9 → REP-10 → REP-11 → REP-12

---

## Epic A — Coach access & API protection

### REP-1 · Authenticate AI coach requests per user (replace shared APP_TOKEN)
**Type:** Security · **Priority:** P0 · **Size:** M · **Depends on:** —

**Why:** `/coach/*` is protected by one shared bearer secret. Anyone holding it can spend the Anthropic
budget, and access can't be revoked per person.

**Scope**
- `/coach/chat` and `/coach/plan` accept the caller's Supabase access token (same verification as `/push/activity`).
- Optional allow-list: a `coach_access` table (or `profiles.coach_enabled` flag) so coach access can be granted/revoked per user.
- App sends the Supabase token automatically; the "Coach link / Coach password" settings are removed for signed-in users.
- Keep APP_TOKEN working for one release behind a flag, then remove.

**Acceptance criteria**
- [ ] Request with no/invalid/expired JWT → `401`; valid JWT for a user without coach access → `403`.
- [ ] Valid JWT for an enabled user → coach responds as today.
- [ ] Revoking a user's access takes effect on their next request without redeploying.
- [ ] Coach tab shows "Coach not set up" / "Ask for coach access" states for signed-out or non-enabled users.
- [ ] APP_TOKEN removed from Render and the codebase in the follow-up release; docs updated.

### REP-2 · Rate-limit the API
**Type:** Security · **Priority:** P0 · **Size:** S · **Depends on:** REP-1 (for per-user limits)

**Scope**
- Per-user limits on `/coach/*` (e.g. 30 chat messages/day, 5 plans/day) and per-IP limits on all routes.
- Limits configurable via env vars; `429` with a friendly `retry-after` message the app displays.
- Return generic errors only (no stack traces / upstream error bodies).

**Acceptance criteria**
- [ ] Exceeding a limit returns `429` + `Retry-After`; the app shows "You've hit today's coach limit — back tomorrow."
- [ ] Limits survive a server restart (store counts in Supabase, not memory) or the trade-off is documented.
- [ ] A load test (e.g. 100 rapid requests) can't push Anthropic usage past the configured cap.

### REP-3 · Tighten CORS and Anthropic spend alerting
**Type:** Security · **Priority:** P1 · **Size:** S · **Depends on:** —

**Scope**
- Restrict `Access-Control-Allow-Origin` to the rep-app origin (env `APP_URL`) instead of `*`.
- Confirm Anthropic Console monthly spend limit is set; add an email alert at 50% / 80%.

**Acceptance criteria**
- [ ] Browser requests from any other origin are rejected by CORS; the app still works.
- [ ] Spend limit + alerts documented in `docs/HOW-IT-WORKS.md` with the owner's name.

---

## Epic B — Account integrity

### REP-4 · Email verification + bot protection on sign-up
**Type:** Security · **Priority:** P1 · **Size:** M · **Depends on:** custom SMTP provider account

**Why:** Confirmation is off (free-tier SMTP is rate-limited), so anyone can register with any email.

**Scope**
- Configure custom SMTP in Supabase (e.g. Resend/Postmark/SES) with a sending domain (SPF/DKIM).
- Turn **Confirm email** on; app handles the "check your inbox" state and resend.
- Enable Supabase CAPTCHA (hCaptcha/Turnstile) on sign-up and password reset.
- Password reset deep-links back into the app and sets a new password.

**Acceptance criteria**
- [ ] New accounts can't sign in until the email is confirmed; the app explains this clearly.
- [ ] Confirmation and reset emails arrive within 1 minute and aren't marked as spam (test Gmail + iCloud).
- [ ] Automated sign-up without solving CAPTCHA fails.
- [ ] Existing accounts are unaffected.

### REP-5 · Account & data deletion
**Type:** Privacy / Compliance · **Priority:** P1 · **Size:** M · **Depends on:** —

**Scope**
- "Delete my account" in You → Account: deletes the auth user (server endpoint using service role) — cascades
  remove profile, friendships, memberships, workouts, steps, feed, reactions, push subscriptions.
- "Export my data" (JSON download of workouts, body log, steps).
- Local "Erase all data" remains for on-device data.

**Acceptance criteria**
- [ ] After deletion, no rows reference the user in any table (verified by a SQL check added to `rls_test.sql` or a new test).
- [ ] The user is signed out on all devices; friends' feeds no longer show their items.
- [ ] Export contains all of the user's synced data in a documented format.

---

## Epic C — Privacy & legal readiness

### REP-6 · Privacy policy, terms and in-app consent
**Type:** Compliance · **Priority:** P0 (before inviting non-friends) · **Size:** M (+ legal review) · **Depends on:** REP-5 for deletion wording

**Why:** The app stores consumer health data (workouts, weight, sleep, HR/HRV) and sends some of it to an
AI provider. State consumer-health-data laws (e.g. Washington's My Health My Data Act) and App Store review
require clear disclosure and consent.

**Scope**
- Privacy policy + terms (hosted pages under the rep-app domain, linked from onboarding and You tab).
- Data inventory: what's collected, where it's stored (device, Supabase, Anthropic, Render), retention, sub-processors.
- Explicit consent screens: (a) account creation, (b) first use of the AI coach — "your profile and recent
  health data are sent to Anthropic to generate advice", (c) joining a challenge — "members will see your
  workouts and steps from the challenge dates".
- Confirm Anthropic API data-retention terms and record them in the data inventory.

**Acceptance criteria**
- [ ] Policy and terms reviewed by someone qualified (legal/compliance) and published.
- [ ] Consent captured and timestamped (`profiles.consented_at`, `coach_consented_at`); features blocked until accepted.
- [ ] Data inventory committed to `docs/`.

### REP-7 · Licensed visual assets audit
**Type:** Compliance · **Priority:** P1 · **Size:** S · **Depends on:** —

**Scope**
- Inventory every image/texture/font with its source and license (`docs/ASSETS.md`).
- Current textures are generated in-repo; fonts are Google Fonts (OFL). Any future Pinterest/photo assets
  require a license or replacement.

**Acceptance criteria**
- [ ] Every file in `assets/` and `public/` has a recorded source + license.
- [ ] No unlicensed third-party imagery ships.

---

## Epic D — Delivery pipeline & quality

### REP-8 · CI pipeline + branch protection
**Type:** DevOps · **Priority:** P0 · **Size:** M · **Depends on:** REP-9, REP-10 (can land incrementally)

**Scope**
- GitHub Actions on every PR: install, `tsc --noEmit` (app + server), ESLint, server build, Playwright e2e
  against the web export, and the RLS suite against a Postgres service container.
- Protect `main`: PRs required, checks must pass, no force-push. Render deploys only from `main`.
- Dependabot (or Renovate) for npm updates; `npm audit --omit=dev` in CI (fail on high/critical).

**Acceptance criteria**
- [ ] A PR that breaks types, lint, an e2e flow or an RLS assertion can't be merged.
- [ ] Direct pushes to `main` are blocked.
- [ ] CI runs in < 10 minutes.

### REP-9 · Commit the end-to-end test suite
**Type:** QA · **Priority:** P0 · **Size:** S · **Depends on:** —

**Scope**
- Move the existing Playwright scripts (onboarding, live workout, past workout, coach states incl. wrong
  password, social screens, challenge builder) into `e2e/` as `@playwright/test` specs with an iPhone profile.
- Add `npm run e2e`; mock the coach server and Supabase for deterministic runs.

**Acceptance criteria**
- [ ] `npm run e2e` passes locally and in CI from a clean checkout.
- [ ] Each spec asserts outcomes (stored data, visible text), not just "no crash".

### REP-10 · Linting & formatting
**Type:** DevEx · **Priority:** P1 · **Size:** S · **Depends on:** —

**Acceptance criteria**
- [ ] `npx expo lint` configured; Prettier config committed; codebase passes with zero errors.
- [ ] Runs in CI (REP-8).

### REP-11 · Error tracking & uptime monitoring
**Type:** Observability · **Priority:** P1 · **Size:** S · **Depends on:** REP-6 (disclose in privacy policy)

**Scope**
- Sentry (or similar) for app and server, with PII scrubbing (no emails, no health values in events).
- Uptime check on `rep-coach/health` with alerting.

**Acceptance criteria**
- [ ] A forced error in app and server appears in the dashboard within a minute, with no PII.
- [ ] Downtime > 5 minutes triggers an alert to the owner.

### REP-12 · Staging environment + automated DB migrations
**Type:** DevOps · **Priority:** P2 · **Size:** L · **Depends on:** REP-8

**Scope**
- Second Supabase project (staging) and Render preview environments per PR.
- Convert `schema.sql` into Supabase CLI migrations; CI applies them to staging on merge, production on release.

**Acceptance criteria**
- [ ] Schema changes reach production only via a migration that has run on staging.
- [ ] No manual SQL-editor steps in the release checklist.

---

## Not in this batch (tracked for later)
- Upgrade hosting tiers before real users depend on the app (Render no-sleep, Supabase backups/no pausing).
- Native iOS build + on-device verification of HealthKit/RingConn/Oura (blocked on Apple Developer Program).


---

# Part 2 — Product backlog (drafts)

From the product owner's "App Backlog" list. These are **drafts**: scope and acceptance criteria are a
starting point, and each has **Open questions** to answer in refinement. Priority is **TBD** until the
product owner ranks them; sizes are rough estimates.

## Epic E — Accounts everywhere

### REP-13 · Account for the whole app, not just the Friends tab
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** REP-4 (email verification) recommended

**Today:** the app works fully signed-out; an account is only needed for Friends & challenges.

**Draft scope**
- Sign up / sign in becomes part of onboarding; profile, goals, body log and settings sync to the account
  (today only finished workouts and steps sync).
- Existing on-device data is uploaded on first sign-in; signing in on a new phone restores everything.
- Coach access tied to the account (pairs naturally with REP-1).

**Draft acceptance criteria**
- [ ] A new user can't reach the main tabs without an account (or an explicit "continue offline" if kept).
- [ ] Signing in on a second device restores profile, goals, body log, workouts, steps and settings.
- [ ] Existing users are prompted once to create an account; their local data is preserved and uploaded.

**Open questions:** Is an offline / no-account mode still allowed? Should body weight and measurements be
visible to challenge-mates (today: no)?

## Epic F — Brand voice & audience

### REP-14 · Broaden the audience while keeping the aesthetic
**Type:** UX / Content · **Priority:** TBD · **Size:** S · **Depends on:** —

**Draft scope**
- Keep the palette, textures, typography and line-heart; make copy and defaults gender-neutral.
- Review onboarding goal labels, coach suggestions and templates for gendered assumptions
  (e.g. coach prompt chip "Give me 3 new glute exercises", goal "Build glutes & legs" as a lead option).
- Optional: let users pick a coach tone (e.g. hype / calm / no-nonsense) instead of one personality.

**Draft acceptance criteria**
- [ ] No gendered copy remains in the app or coach system prompt (checklist reviewed with product owner).
- [ ] Visual identity (colours, textures, fonts) unchanged.

### REP-15 · Remove the "that girl" voice from copy
**Type:** Content · **Priority:** TBD (quick win) · **Size:** S · **Depends on:** part of REP-14

Current strings to rewrite (with location):

| Where | Current copy |
|---|---|
| Today header (`app/(tabs)/index.tsx`) | fallback name "gorgeous" |
| Workout finish (`app/workout/[id].tsx`) | "1 = rough · 5 = that girl" |
| Progress header (`app/(tabs)/progress.tsx`) | "Proof you're glowing up." |
| You header (`app/(tabs)/you.tsx`) | "{name} era." |
| Onboarding (`app/onboarding.tsx`) | "Your strongest era starts here." |
| Friends card (`app/(tabs)/friends.tsx`) | "Accountability, but cute" |
| New challenge (`app/challenge-new.tsx`) | placeholder "Glute girls November" |

**Draft acceptance criteria**
- [ ] All strings above replaced with approved copy (product owner sign-off on a copy sheet).
- [ ] Coach persona prompt reviewed for the same tone.

**Open questions:** Desired voice in one sentence (e.g. "calm, confident, a little dry")?

## Epic G — Goals

### REP-16 · More customizable goals
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** —

**Today:** goals are a fixed list of categories (get stronger, lose fat…) plus goal weight and step goal.

**Draft scope**
- Measurable custom goals with a target and optional deadline, e.g. "Hip thrust 225 lb", "Run 5K under 30 min",
  "Waist 28 in", "4 workouts/week", "10,000 steps/day", or free-text.
- Goal types: lift (exercise + weight × reps), body metric, frequency, steps, cardio time/distance, custom.
- Goals feed the AI coach context.

**Draft acceptance criteria**
- [ ] User can create, edit, pause and delete goals of each type.
- [ ] Each goal shows current value vs. target, computed from logged data where possible.

### REP-17 · Goal history and progress over time
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** REP-16

**Draft scope**
- Keep a history when a goal changes (old target, new target, date) instead of overwriting it.
- Progress chart per goal (value over time with the target line and any changes marked); completed goals archive.

**Draft acceptance criteria**
- [ ] Changing a goal's target creates a history entry; the chart shows the change point.
- [ ] Completed goals are kept and viewable with the completion date.

**Open questions:** Should goals sync/share with challenge-mates? Celebrate completions (notification/feed)?

## Epic H — Workout logging

### REP-18 · Compare against previous workouts
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** —

**Today:** last session's numbers prefill new sets; PRs (estimated 1RM) are listed on the Train tab.

**Draft scope**
- In the logger, show "last time" per exercise (date, sets × reps × weight) and the delta as you log
  (e.g. "+5 lb vs last time", "+2 reps").
- Per-exercise history screen: sessions list, best set, e1RM and volume trend charts.
- Workout summary on finish: volume/duration vs. the last similar workout, new PRs highlighted.

**Draft acceptance criteria**
- [ ] Each exercise card shows the previous session and a live delta.
- [ ] Tapping an exercise opens its history with at least e1RM and volume charts.
- [ ] Finishing a workout shows a comparison summary and any PRs.

### REP-19 · Warm-up vs working sets
**Type:** Feature · **Priority:** TBD · **Size:** S · **Depends on:** —

**Draft scope**
- Set type per set: warm-up / working (optionally drop set / failure).
- Warm-up sets are excluded from volume, PRs, e1RM, comparisons and challenge stats.

**Draft acceptance criteria**
- [ ] User can mark a set as warm-up in one tap; it's visually distinct.
- [ ] Warm-ups don't change PRs or volume; existing sets default to "working".

### REP-20 · Bigger exercise library + save custom exercises
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** —

**Today:** ~90 built-in exercises. A typed-in name can be added to a workout, but it isn't saved to the
library, so it doesn't show up in search next time.

**Draft scope**
- Expand the library, especially **unilateral** options (single-leg RDL, single-leg hip thrust, single-leg
  press, Cossack squat, single-arm row/press/pulldown, single-arm cable work, etc.).
- Mark exercises as unilateral and allow per-side logging (left/right reps) where relevant.
- "Not finding it? Create exercise": name, category, muscle group, type (weights / bodyweight / time /
  distance) → saved to the user's library (synced to the account once REP-13 lands).

**Draft acceptance criteria**
- [ ] Search returns custom exercises alongside built-ins; they can be edited and deleted.
- [ ] At least N new unilateral exercises added (N agreed with product owner).

**Open questions:** Per-side logging required, or just the exercise name? Should custom exercises be
shareable inside challenge plans? (Plans already accept free-text names.)

## Epic I — Reminders & notifications

### REP-21 · Reminders to log workouts
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** REP-13 (needs account email), REP-4 (email sending)

**Draft scope**
- User-set schedule (days + time) and/or "nudge me if I haven't logged by X on a training day".
- Delivery via **email** (as requested) and/or push (already built for friends).
- Unsubscribe link in every email; per-reminder on/off.

**Draft acceptance criteria**
- [ ] Reminders send at the user's local time; none sent if a workout was already logged that day.
- [ ] One-click unsubscribe works; preference saved.

**Open questions:** Email only, or push too? Weekly summary email?

### REP-22 · Reminders to log meals
**Type:** Feature · **Priority:** TBD · **Size:** S · **Depends on:** REP-21, REP-28

Same mechanism as REP-21, scheduled around meal times. Only meaningful once meal tracking exists (REP-28).

## Epic J — Friends & challenges

### REP-23 · Clearer, more descriptive points system
**Type:** Feature / UX · **Priority:** TBD · **Size:** M · **Depends on:** —

**Today:** fixed rules (workout +10, 1,000 steps +1, step goal +5, streak day +3, plan bonus +5); the
leaderboard shows totals plus a few stats.

**Draft scope**
- "How scoring works" sheet on every challenge.
- Points breakdown per person (tap a row → points by category and by day).
- Feed items show points earned ("+10 · Lower body").
- Option to weight categories differently per challenge (see REP-24).

**Draft acceptance criteria**
- [ ] Any member can see exactly why each person has their score.
- [ ] Breakdown totals always equal the leaderboard total (verified by SQL test).

**Open questions:** What felt unclear today — the rules, the numbers, or both? Points for things like
duration, effort, PRs, or Pilates/cardio specifically?

### REP-24 · More customizable challenges (times, details)
**Type:** Feature · **Priority:** TBD · **Size:** M · **Depends on:** REP-23

**Draft scope**
- Custom start/end dates and times (not just presets); time zone shown.
- Edit after creation (creator): name, description/rules text, end date, step goal, plan, scoring weights.
- Optional: cover texture/colour, max members, weekly targets (e.g. "3 plan workouts per week").

**Draft acceptance criteria**
- [ ] Creator can edit details; members see a "challenge updated" feed item.
- [ ] Changing scoring recalculates the leaderboard consistently.

**Open questions:** Which "times" matter — start/end times, workout windows (e.g. "before 9am counts double"),
or deadlines per plan workout?

### REP-25 · Creator can delete a challenge
**Type:** Feature · **Priority:** TBD (quick win) · **Size:** S · **Depends on:** —

**Today:** the database already allows the creator to delete a challenge (and members to leave); there's
no button for it.

**Draft scope**
- "Delete challenge" (creator only) with a confirmation step; removes members, feed and reactions.
- Members get a notification/feed note before deletion, or it disappears from their list.
- Optional: transfer ownership instead of deleting.

**Draft acceptance criteria**
- [ ] Only the creator sees and can use Delete (also enforced by RLS — already in place).
- [ ] After deletion the challenge disappears for all members; their own workouts are untouched.

## Epic K — Data & intelligence

### REP-26 · Import data from health apps
**Type:** Feature · **Priority:** TBD · **Size:** L · **Depends on:** native iOS build (Apple Developer Program) for HealthKit

**Today:** Apple Health (incl. RingConn) and Oura are code-complete but only work in the native app.

**Draft scope (to confirm)**
- Ship the native build so Apple Health / RingConn / Oura actually run.
- Additional sources to evaluate: Strava, Garmin, Fitbit/Google Health Connect, Whoop, Strong/Hevy CSV import
  (bring over past workout history).
- One-time history import vs. ongoing sync per source.

**Draft acceptance criteria**
- [ ] Each supported source has connect / disconnect / last-synced status.
- [ ] Imported workouts are de-duplicated against manual logs.

**Open questions:** Which apps first? Workout history import, daily metrics, or both?

### REP-27 · AI personal trainer — next iteration
**Type:** Feature · **Priority:** TBD · **Size:** TBD · **Depends on:** REP-1 (per-user coach auth)

**Today:** chat + weekly plan (focus, recommendations, step goal, recovery) using profile, goals, recent
workouts, PRs and wearable data.

**Placeholder** — product owner to describe what's missing. Candidate ideas: turn a coach plan into a
startable workout or a challenge plan in one tap; coach adjusts weights/reps set-by-set during a workout;
proactive weekly check-in notification; uses goals from REP-16; remembers preferences between chats.

### REP-28 · Meal / calorie intake tracker
**Type:** Feature · **Priority:** TBD · **Size:** L · **Depends on:** — (REP-22 depends on this)

**Draft scope (to confirm)**
- Log meals with calories and macros (protein/carbs/fat); daily targets based on goals.
- Food search (needs a nutrition database/API — e.g. USDA FoodData Central, Open Food Facts), barcode scan
  (native), quick-add calories, saved meals.
- Daily/weekly summary; feeds the AI coach context.

**Draft acceptance criteria**
- [ ] User can log a meal in under 30 seconds via search or quick-add.
- [ ] Daily totals vs. targets are visible on Today.

**Open questions:** Full macro tracking or calories only? Should nutrition ever be visible to challenge-mates?
Privacy: eating data is sensitive — needs explicit coverage in REP-6.
