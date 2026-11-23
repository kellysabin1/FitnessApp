-- Daily workout reminders: every 15 minutes Supabase pokes the rep. coach server, which sends
-- reminders to whoever is due (see due_reminders() in schema.sql). Running it from the database
-- means reminders still go out while the free Render server is asleep — the poke wakes it up.
--
-- Run once on Supabase after schema.sql (safe to re-run). Needs the pg_cron and pg_net extensions.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A random shared key so only this scheduled job can trigger a reminder run.
-- Lives in app_secrets (service-role only); the server reads it from there too — nothing to copy anywhere.
insert into public.app_secrets (key, value)
values ('reminder_cron_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

select cron.schedule(
  'rep-reminders',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://rep-coach.onrender.com/reminders/run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-key', (select value from public.app_secrets where key = 'reminder_cron_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 90000
    );
  $job$
);
