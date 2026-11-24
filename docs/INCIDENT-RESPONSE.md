# If personal or health data may have leaked (incident response)

rep. handles consumer health data, so a breach has legal deadlines. Keep this short and follow it.

**A breach** includes any access to, or disclosure of, someone's data they didn't authorize — a hacked
account or database, a leaked key, a bug that shows one person's data to another, or sending data somewhere
the policy doesn't allow (the FTC treats that as a breach too).

## Within the first hour

1. **Contain it.** Rotate anything that may be exposed: Supabase service-role key and database password
   (Supabase → Settings → API / Database), the Anthropic key, the Supabase access token. Disable the broken
   feature or take `rep-coach` offline in Render if needed.
2. **Preserve evidence.** Don't delete logs. Note times, what you saw, and who knows.
3. Write down: what data, whose (how many people), from when to when, and how.

## Within days

4. Fix the cause and add a test that would have caught it (`npm run test:db` / `npm run e2e`).
5. **Get legal advice** on notification duties — do this early, deadlines run from discovery.

## Notification deadlines (US, as of 2026 — confirm with a lawyer)

- **People affected:** without unreasonable delay, and no later than **60 days** after discovery
  (FTC Health Breach Notification Rule; most state breach laws are similar or shorter).
- **FTC:** if 500+ people are affected, at the same time as notifying people; if fewer, in an annual log
  submitted within 60 days after the end of the calendar year.
- **Media:** if 500+ residents of one state are affected (FTC rule).
- **State attorneys general:** many states require notice above a threshold (e.g. Washington: 500+ residents,
  within 30 days).
- Notices say what happened, what data, what we're doing, what people can do, and how to contact us.

## Afterwards

6. Short write-up in `docs/` (what happened, impact, fix, prevention). Update `docs/PRIVACY.md` if anything changed.
