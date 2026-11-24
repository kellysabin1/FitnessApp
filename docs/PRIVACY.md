# Privacy, consent & health-data handling (REP-5, REP-6)

This is the engineering-side record behind the in-app **Privacy Policy** and **Terms** (`src/legal.ts`,
shown at `/privacy` and `/terms`). If anything here changes, update `src/legal.ts` in the same pull request,
and bump the matching version in `src/consent.ts` when the change is material (people are asked again).

> **Status: draft, not legal advice.** Before inviting people beyond friends and family, have the policy, the
> terms and this inventory reviewed by a qualified privacy lawyer (US: Washington My Health My Data Act,
> state privacy laws, FTC Health Breach Notification Rule; EU/UK users: GDPR special-category data). See
> "Before launch" below, and the compliance review in [`LEGAL-REVIEW.md`](LEGAL-REVIEW.md).

## Data inventory

| Data                                                                                                                                       | Where it lives                                                             | Who can see it                                                      | Sent elsewhere                                                                | Kept                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| Email, password hash                                                                                                                       | Supabase Auth                                                              | Only you (and the owner via the Supabase dashboard)                 | Email provider, only once email features are on                               | Until account deletion                          |
| @username, display name                                                                                                                    | `profiles`                                                                 | Any signed-in rep. user (to find friends)                           | —                                                                             | Until account deletion                          |
| Coach access flag                                                                                                                          | `profiles.coach_enabled`                                                   | Server only (column hidden from users since v8)                     | —                                                                             | Until account deletion                          |
| Profile: name, sex, birth year, height, goals, experience, days/week, equipment, injuries/preferences notes, step goal, goal weight, units | `user_data.profile/settings` + on the phone                                | Only you                                                            | Anthropic, if you allowed the AI coach, per request                           | Until account deletion                          |
| Splits, targets, check-ins, custom exercises                                                                                               | `user_data` + on the phone                                                 | Only you                                                            | Anthropic (targets, split) if AI coach allowed                                | Until account deletion                          |
| Workouts (exercises, sets, weights, reps, times, split tags)                                                                               | `workouts` + on the phone                                                  | You; members of a challenge you're in, **for challenge dates only** | Anthropic (last 12) if AI coach allowed                                       | Until you delete it or the account              |
| Body log: weight, body fat, waist, hips                                                                                                    | `body_entries` + on the phone                                              | **Only you** — never challenge members                              | Anthropic (weight/body fat) if AI coach allowed                               | Until account deletion                          |
| Daily steps                                                                                                                                | `daily_steps` + on the phone                                               | You; challenge members for challenge dates                          | Anthropic (7 days) if AI coach allowed                                        | Until account deletion                          |
| Wearable data: sleep, HR, HRV, readiness (Apple Health / Oura)                                                                             | **Phone only**                                                             | Only you                                                            | Anthropic (7-day summary) if AI coach allowed; Oura API when you connect Oura | Until sign-out / app removal                    |
| AI coach chat and latest coach plan                                                                                                        | **Phone only**                                                             | Only you                                                            | Anthropic, per request                                                        | Until sign-out / app removal                    |
| Friendships, challenge memberships, feed posts, reactions, daily task ticks                                                                | `friendships`, `challenge_members`, `activity`, `reactions`, `task_checks` | The people involved / challenge members                             | Push services (notification text)                                             | Until account deletion                          |
| Reminder settings (time, time zone, rest day)                                                                                              | `reminder_settings`                                                        | Only you                                                            | —                                                                             | Until account deletion                          |
| Consent log (what you agreed to, version, time)                                                                                            | `consents` (append-only)                                                   | Only you                                                            | —                                                                             | Until account deletion                          |
| Notification device address                                                                                                                | `push_subscriptions`                                                       | Server only                                                         | Apple/Google/Mozilla push service                                             | Until you turn off / reinstall / delete account |
| Error reports (type, scrubbed message, stack frames, screen path)                                                                          | `error_events` (server-only)                                               | Owner                                                               | —                                                                             | 30 days                                         |
| AI usage counters (count per day)                                                                                                          | `coach_usage` (server-only)                                                | Owner                                                               | —                                                                             | 60 days                                         |

**Not collected:** location, contacts, photos, advertising IDs, analytics or tracking SDKs. No data is sold
or used for ads.

## Sub-processors

| Provider                               | Purpose                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase                               | Database, sign-in                                      | Encryption at rest and in transit; RLS on every table                                                                                                                                                                                                                                                                                                                                    |
| Render                                 | Hosts the web app (`rep-app`) and server (`rep-coach`) | Server logs contain no request bodies or health data                                                                                                                                                                                                                                                                                                                                     |
| Anthropic                              | AI coach (Claude API)                                  | Only after AI-coach consent; enforced in the app **and** on the server. Commercial Terms (effective 2025-06-17): "Anthropic may not train models on Customer Content from Services". Data Processing Addendum (effective 2025-02-24): Anthropic is our processor. **Retention period: not yet verified** — confirm on Anthropic's privacy center before launch and add it to the policy. |
| Apple / Google / Mozilla push services | Deliver notifications                                  | Notification text only: reminder text, friend's name + workout title                                                                                                                                                                                                                                                                                                                     |
| Oura                                   | Wearable data                                          | Only if the person connects Oura                                                                                                                                                                                                                                                                                                                                                         |
| Resend (planned)                       | Email reminders / verification                         | Not active until `RESEND_API_KEY` is set                                                                                                                                                                                                                                                                                                                                                 |

## Consent (REP-6)

Recorded in `consents` (append-only; latest row per kind wins; `granted=false` = withdrawn):

| Kind                | Asked                                                                                        | Blocks until given                                              |
| ------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `terms_privacy`     | Sign-up (checkbox, links to both documents, 16+) and once for existing accounts (`/consent`) | The whole app                                                   |
| `health_data`       | Separate checkbox at sign-up / `/consent`                                                    | The whole app                                                   |
| `ai_coach`          | First visit to the Coach tab: lists exactly what is sent to Anthropic                        | Every `/coach/*` request — app **and** server (`needs_consent`) |
| `challenge_sharing` | Notice on create / join screens; invite links no longer auto-join — they need a tap          | Recorded with the challenge code on each create/join            |

Withdraw: AI coach → You → Privacy & your data → Turn off. Challenge sharing → leave the challenge.
Everything → delete the account.

## Your data export (REP-5)

You → Privacy & your data → **Download my data** saves `rep-data-YYYY-MM-DD.json`:

```jsonc
{
  "format": "rep-export",
  "version": 1,
  "exportedAt": "2026-11-24T18:00:00.000Z",
  "units": "Weights in kg, lengths in cm, durations in minutes; times are ISO 8601 (UTC).",
  "account": { "userId", "email", "username", "displayName" },
  "cloud": {
    "profile", "userData" /* profile, settings, custom exercises, splits, targets */,
    "bodyEntries", "workouts", "dailySteps", "reminderSettings", "consents",
    "challengeMemberships", "challengesCreated", "feedItems", "dailyTaskChecks", "friendships",
    "notificationDevices" /* count only — device keys are secrets */
  },
  "thisPhone": { "health" /* wearable data */, "coachChat", "coachPlan" }
}
```

## Account deletion (REP-5)

You → Privacy & your data → Delete my account → password + type `DELETE`. The server
(`POST /account/delete`, 5 password tries an hour) re-checks the password, removes nudges addressed to the
person (`delete_account_data`), then deletes the auth user. Every table references `profiles` / `auth.users`
with `ON DELETE CASCADE`, so all rows go with it, including challenges they created (for everyone) and
their workouts/steps in friends' challenge views. Refresh tokens are revoked (signed out everywhere). The
phone is cleared. `supabase/rls_test.sql` T61 asserts no row references a deleted user.
Supabase free tier has no backups, so deletion is immediate and complete; if backups are enabled later,
document their retention here and in the policy.

## Security measures (health-data hardening)

- **Access control:** Row-level security on every table; body log, user data, reminders and consents are
  owner-only; challenge visibility limited to challenge dates (`shared_on_day`); server-only tables have RLS
  with no policies; profile columns readable by other users limited to id / username / display name;
  security-definer functions pin `search_path`; privileged RPCs revoked from `anon`/`authenticated`.
  53+ automated checks (`npm run test:db`).
- **Sign-in:** 8-character minimum for new passwords (app + Supabase setting); refresh-token rotation on;
  the shared coach password is retired (`ALLOW_APP_TOKEN` must be explicitly `true`).
- **Transport & browser:** HTTPS only (HSTS), strict Content-Security-Policy (scripts only from the app's own
  origin; network only to Supabase, rep-coach and Oura), no framing, no referrer, camera/mic/location off.
  The e2e suite runs under the same headers and fails on any CSP violation.
- **API:** CORS allows only the rep. web app (and localhost for development); `Cache-Control: no-store`;
  per-IP and per-person rate limits; request bodies are never logged.
- **Error reports:** scrubbed of emails, ids, tokens/keys and **all numbers** before storage
  (`server/test/monitoring.test.ts`).
- **On the phone:** data is cached in app storage so rep. works offline; signing out wipes it. Recommend a
  device passcode (stated in the policy).

## Before launch (owner checklist)

- [ ] Lawyer review of `src/legal.ts` + this file (incl. Washington MHMDA consumer-health-data policy
      requirements and breach-notification duties).
- [ ] Operator name, privacy contact email and governing-law state (`EXPO_PUBLIC_OPERATOR_NAME`, `EXPO_PUBLIC_PRIVACY_CONTACT`, `EXPO_PUBLIC_GOVERNING_LAW`) — see `docs/LEGAL-REVIEW.md` §3.
- [ ] Confirm Anthropic's API retention period and add it to the policy's AI section.
- [x] Password-reset links return to the app (`/reset-password`); rep-app addresses are in Supabase's redirect allow-list.
- [ ] Turn on email confirmation + CAPTCHA (REP-4).
- [ ] Consider Supabase Pro (backups, no pausing) and record backup retention here.
