-- Scheduled jobs that run inside Supabase (pg_cron + pg_net). Run on Supabase after schema.sql; safe to re-run.
-- Not part of schema.sql because local test databases don't have these extensions.
--
--   rep-reminders  every 15 min  poke rep-coach to send due workout reminders (works while Render sleeps)
--   rep-uptime     every 5 min   ping rep-coach /health; failures are logged to error_events
--   rep-retention  daily         delete old error logs and usage counters

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

-- Uptime check: look at the answers to earlier pings, log any failure, then send the next ping.
create or replace function public.uptime_check()
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare r record;
begin
  for r in
    select p.request_id, resp.status_code, resp.timed_out, resp.error_msg
    from uptime_pings p
    left join net._http_response resp on resp.id = p.request_id
    where not p.checked and p.at < now() - interval '2 minutes'
  loop
    if r.status_code is distinct from 200 then
      insert into error_events (source, kind, message)
      values ('uptime', 'down', 'rep-coach /health: ' || coalesce(r.status_code::text, case when r.timed_out then 'timed out' else left(coalesce(r.error_msg, 'no response'), 120) end));
    end if;
    update uptime_pings set checked = true where request_id = r.request_id;
  end loop;
  delete from uptime_pings where at < now() - interval '2 days';
  insert into uptime_pings (request_id)
  select net.http_get(url := 'https://rep-coach.onrender.com/health', timeout_milliseconds := 60000);
end $$;
revoke all on function public.uptime_check() from public, anon, authenticated;

select cron.schedule('rep-uptime', '*/5 * * * *', 'select public.uptime_check()');

-- Retention: error logs 30 days, coach usage counters 60 days.
select cron.schedule(
  'rep-retention',
  '17 3 * * *',
  $job$
    delete from public.error_events where at < now() - interval '30 days';
    delete from public.coach_usage where day < current_date - 60;
  $job$
);
