# rep. — hardening backlog

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
