\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
\set ON_ERROR_STOP 0
\pset tuples_only on
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;

select pg_temp.as_user(:'A'); insert into profiles(id, username, display_name) values (:'A', 'kelly', 'Kelly');
select pg_temp.as_user(:'B'); insert into profiles(id, username, display_name) values (:'B', 'bestie', 'Bestie');
select pg_temp.as_user(:'C'); insert into profiles(id, username, display_name) values (:'C', 'stranger', 'Stranger');
\echo '--- T1 cannot create a profile for someone else (expect ERROR):'
select pg_temp.as_user(:'C'); insert into profiles(id, username) values ('00000000-0000-0000-0000-0000000000ff', 'fake');
\echo '--- T2 bad username rejected (expect ERROR):'
update profiles set username = 'Bad Name!' where id = :'C';

select pg_temp.as_user(:'A'); insert into friendships(requester, addressee) values (:'A', :'B');
\echo '--- T3 reverse duplicate request blocked (expect ERROR):'
select pg_temp.as_user(:'B'); insert into friendships(requester, addressee) values (:'B', :'A');
\echo '--- T4 requester cannot accept own request; status should stay pending:'
select pg_temp.as_user(:'A'); update friendships set status = 'accepted' where requester = :'A';
select status from friendships;
\echo '--- T5 stranger sees 0 friendships:'
select pg_temp.as_user(:'C'); select count(*) from friendships;
\echo '--- T6 addressee accepts -> accepted:'
select pg_temp.as_user(:'B'); update friendships set status = 'accepted' where addressee = :'B'; select status from friendships;

select pg_temp.as_user(:'A');
select id as ch from create_challenge('Glute girls', current_date - 1, current_date + 13, true, true, true, true, 8000,
  '[{"title":"Glutes & hamstrings","exercises":["Hip Thrust"]}]') \gset
\echo '--- T7 friend added directly OK; stranger cannot be added (expect ERROR):'
select add_friend_to_challenge(:'ch', :'B');
select add_friend_to_challenge(:'ch', :'C');
\echo '--- T8 stranger cannot see challenge (expect 0):'
select pg_temp.as_user(:'C'); select count(*) from challenges;

select pg_temp.as_user(:'A');
insert into workouts(user_id, id, title, started_at, finished_at, local_day, duration_min, plan_item)
values (:'A', 'w1', 'Glutes & hamstrings', now() - interval '1 day', now() - interval '1 day' + interval '45 min', current_date - 1, 45, 'Glutes & hamstrings'),
       (:'A', 'w2', 'Upper', now(), now() + interval '40 min', current_date, 40, null);
insert into daily_steps(user_id, day, steps) values (:'A', current_date - 1, 9000);
-- an old workout + steps from before the challenge started (should stay private)
insert into workouts(user_id, id, title, started_at, finished_at, local_day, duration_min)
values (:'A', 'old', 'Before the challenge', now() - interval '30 days', now() - interval '30 days' + interval '30 min', current_date - 30, 30);
insert into daily_steps(user_id, day, steps) values (:'A', current_date - 30, 12000);
\echo '--- T9 stranger cannot write a workout as Kelly (expect ERROR):'
select pg_temp.as_user(:'C'); insert into workouts(user_id, id, started_at, finished_at, local_day) values (:'A', 'x', now(), now(), current_date);
\echo '--- T10 stranger sees 0 of Kellys workouts / steps:'
select count(*) from workouts; select count(*) from daily_steps;
\echo '--- T11 challenge-mate sees only the 2 in-challenge workouts / 1 steps row (not the one from 30 days ago):'
select pg_temp.as_user(:'B'); select count(*) from workouts; select count(*) from daily_steps;
\echo '--- T12 stranger cannot post to the feed (expect ERROR):'
select pg_temp.as_user(:'C'); insert into activity(challenge_id, user_id, kind) values (:'ch', :'C', 'workout');
\echo '--- T13 member posts + reacts; cannot fake created/joined (expect ERROR on 2nd insert):'
select pg_temp.as_user(:'B'); insert into activity(challenge_id, user_id, kind, payload) values (:'ch', :'B', 'workout', '{"title":"Leg day"}') returning id \gset
insert into activity(challenge_id, user_id, kind) values (:'ch', :'B', 'joined');
select pg_temp.as_user(:'A'); insert into reactions(activity_id, user_id, emoji) values (:id, :'A', '🔥'); select count(*) from reactions;
\echo '--- T14 stranger joins by code, then sees the challenge and only the 2 in-challenge workouts:'
select pg_temp.as_user(:'A'); select invite_code as code from challenges \gset
select pg_temp.as_user(:'C'); select join_challenge(lower(:'code')) is not null; select count(*) from challenges; select count(*) from workouts;
\echo '--- T15 wrong code (expect ERROR):'
select join_challenge('ZZZZZZ');
\echo '--- T16 app_secrets hidden from users (expect 0 / ERROR on insert):'
select count(*) from app_secrets; insert into app_secrets values ('x','y');
\echo '--- T17 leaderboard (expect kelly 42 pts: 2 workouts, 9000 steps, 1 streak day, 1 plan, current streak 2):'
select pg_temp.as_user(:'A'); select username, workouts, steps, streak_days, plan_done, current_streak, points from challenge_leaderboard(:'ch');
\echo '--- T18 non-member leaderboard (expect ERROR):'
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee');
select * from challenge_leaderboard(:'ch');
\echo '--- T19 anonymous (signed out) sees no profiles and cannot call functions (expect 2 permission ERRORs):'
reset role; set role anon; select count(*) from profiles;
select join_challenge('ZZZZZZ');

reset role; set role authenticated;
\echo '--- T20 plan-only challenge: only the plan workout counts (expect kelly 24 pts: 1 workout, 9000 steps, 0 streak days, 1 plan, current streak 1):'
select pg_temp.as_user(:'A');
select id as pch from create_challenge('Plan only', current_date - 1, current_date + 13, true, true, true, true, 8000,
  '[{"title":"Glutes & hamstrings","exercises":["Hip Thrust"]}]', 'plan') \gset
select score_plan from challenges where id = :'pch';
select username, workouts, steps, streak_days, plan_done, current_streak, points from challenge_leaderboard(:'pch') where username = 'kelly';
\echo '--- T21 plan-only challenge with no plan (expect ERROR):'
select create_challenge('Empty plan', current_date, current_date + 6, true, true, true, true, 8000, '[]', 'plan');
\echo '--- T22 invalid mode (expect ERROR):'
select create_challenge('Weird', current_date, current_date + 6, true, true, true, true, 8000, '[]', 'sometimes');
\echo '--- T22b points breakdown adds up (expect 20 workouts + 14 steps + 3 streak + 5 plan = 42, 1 goal day):'
select pts_workouts, pts_steps, pts_streaks, pts_plan, pts_workouts + pts_steps + pts_streaks + pts_plan = points as adds_up, goal_days
from challenge_leaderboard(:'ch') where username = 'kelly';
\echo '--- T23 any-workout challenge unchanged (expect kelly 42):'
select points from challenge_leaderboard(:'ch') where username = 'kelly';

\echo '--- T24 Kelly still sees all 3 of her own workouts:'
select pg_temp.as_user(:'A'); select count(*) from workouts where user_id = :'A';

-- ───── v3: coach access, usage limits, deleting challenges ─────
reset role; set role authenticated;
\echo '--- T25 user cannot switch on their own coach access (expect permission ERROR):'
select pg_temp.as_user(:'A'); update profiles set coach_enabled = true where id = :'A';
\echo '--- T26 user can still edit their display name (expect Kelly R):'
update profiles set display_name = 'Kelly R' where id = :'A'; select display_name from profiles where id = :'A';
\echo '--- T27 users cannot call the usage counter or read usage (expect ERROR, then 0):'
select bump_coach_usage(:'A', 'chat', 30);
select count(*) from coach_usage;
\echo '--- T28 server counts uses up to the limit (expect 1, 2, then empty = limit reached; plans separate = 1):'
reset role; set role service_role;
select bump_coach_usage(:'A', 'chat', 2); select bump_coach_usage(:'A', 'chat', 2); select bump_coach_usage(:'A', 'chat', 2) is null as limited;
select bump_coach_usage(:'A', 'plan', 5);
\echo '--- T29 non-creator delete removes nothing (expect 0), challenge still there (expect 1):'
reset role; set role authenticated; select pg_temp.as_user(:'B');
with d as (delete from challenges where id = :'ch' returning 1) select count(*) from d;
select count(*) from challenges where id = :'ch';
\echo '--- T30 creator delete removes challenge, members and feed (expect 1, then 0 0 0):'
select pg_temp.as_user(:'A');
with d as (delete from challenges where id = :'ch' returning 1) select count(*) from d;
reset role;
select (select count(*) from challenges where id = :'ch'), (select count(*) from challenge_members where challenge_id = :'ch'), (select count(*) from activity where challenge_id = :'ch');
\echo '--- T31 Kellys workouts survive the challenge deletion (expect 3):'
select count(*) from workouts where user_id = :'A';

\echo '--- T32 challenge with a custom length (40 days) and a description (expect 40, text):'
reset role; set role authenticated; select pg_temp.as_user(:'A');
select (ends_on - starts_on + 1) as days, description from create_challenge('Custom', current_date, current_date + 39, true, true, true, true, 8000, '[]', 'any', '  Hit 4 workouts a week  ');
\echo '--- T33 description over 500 characters (expect ERROR):'
select create_challenge('Too long', current_date, current_date + 6, true, true, true, true, 8000, '[]', 'any', repeat('x', 501));

-- ───── v5: private account data, daily tasks ─────
reset role; set role authenticated;
\echo '--- T34 owner writes own profile data + body entry (expect 1, 1):'
select pg_temp.as_user(:'A');
insert into user_data(user_id, profile, settings) values (:'A', '{"name":"Kelly","goals":["recomp"]}', '{"units":"us"}');
insert into body_entries(user_id, id, day, weight_kg) values (:'A', 'b1', current_date, 64.5);
select count(*) from user_data; select count(*) from body_entries;
\echo '--- T35 friend in a shared challenge cannot see Kellys profile data or body stats (expect 0, 0):'
select pg_temp.as_user(:'A');
select id as pch2 from create_challenge('Shared', current_date - 1, current_date + 6, true, true, true, true, 8000, '[]') \gset
select add_friend_to_challenge(:'pch2', :'B');
select pg_temp.as_user(:'B'); select count(*) from user_data where user_id = :'A'; select count(*) from body_entries where user_id = :'A';
\echo '--- T36 cannot write someone elses body stats (expect ERROR):'
insert into body_entries(user_id, id, day, weight_kg) values (:'A', 'evil', current_date, 50);
\echo '--- T37 challenge with tasks: blanks dropped + trimmed (expect ["Drink 3 L water", "Stretch 10 min"]):'
select pg_temp.as_user(:'A');
select id as tch, tasks from create_challenge('Tasks', current_date - 1, current_date + 6, true, true, true, true, 8000, '[]', 'any', null,
  '["  Drink 3 L water ", "", "Stretch 10 min"]') \gset
select :'tasks';
select add_friend_to_challenge(:'tch', :'B');
\echo '--- T38 four tasks / overlong task (expect 2 ERRORs):'
select create_challenge('Too many', current_date, current_date + 6, true, true, true, true, 8000, '[]', 'any', null, '["a","b","c","d"]');
select create_challenge('Too long', current_date, current_date + 6, true, true, true, true, 8000, '[]', 'any', null, jsonb_build_array(repeat('x', 61)));
\echo '--- T39 tick tasks today (expect 2 rows); task 3 does not exist / 5 days ago / for someone else (expect 3 ERRORs):'
insert into task_checks(challenge_id, user_id, day, task_index) values (:'tch', :'A', current_date, 0), (:'tch', :'A', current_date, 1);
select count(*) from task_checks where challenge_id = :'tch';
insert into task_checks(challenge_id, user_id, day, task_index) values (:'tch', :'A', current_date, 2);
insert into task_checks(challenge_id, user_id, day, task_index) values (:'tch', :'A', current_date - 5, 0);
insert into task_checks(challenge_id, user_id, day, task_index) values (:'tch', :'B', current_date, 0);
\echo '--- T40 stranger cannot see or tick (expect 0, then ERROR):'
select pg_temp.as_user(:'C'); select count(*) from task_checks;
insert into task_checks(challenge_id, user_id, day, task_index) values (:'tch', :'C', current_date, 0);
\echo '--- T41 leaderboard counts tasks (expect kelly tasks_done 2, pts_tasks 4, total includes them):'
select pg_temp.as_user(:'A');
select username, tasks_done, pts_tasks, points, pts_workouts + pts_steps + pts_streaks + pts_plan + pts_tasks = points as adds_up
from challenge_leaderboard(:'tch') where username = 'kelly';

-- ───── v6: splits and targets ─────
reset role; set role authenticated;
\echo '--- T42 owner saves splits + targets (expect 1 split, 1 target):'
select pg_temp.as_user(:'A');
update user_data set splits = '[{"id":"s1","name":"Upper/lower","workouts":[]}]', targets = '[{"id":"t1","kind":"lift","title":"Hip Thrust 155 lb"}]' where user_id = :'A';
select jsonb_array_length(splits), jsonb_array_length(targets) from user_data where user_id = :'A';
\echo '--- T43 another user cannot read or overwrite them (expect 0 rows read, 0 rows updated):'
select pg_temp.as_user(:'B');
select count(*) from user_data where user_id = :'A';
with u as (update user_data set targets = '[]' where user_id = :'A' returning 1) select count(*) from u;
\echo '--- T44 oversized splits rejected (expect check constraint ERROR):'
select pg_temp.as_user(:'A');
update user_data set splits = jsonb_build_array(repeat('x', 300001)) where user_id = :'A';

-- ───── v7: split tags on workouts, daily reminders ─────
reset role; set role authenticated;
\echo '--- T45 workouts keep their split tags (expect s1 | w2):'
select pg_temp.as_user(:'C');
insert into workouts(user_id, id, title, started_at, finished_at, local_day, split_id, split_workout_id)
  values (:'C', 'sw1', 'Lower A', now() - interval '3 days', now() - interval '3 days', current_date - 3, 's1', 'w2');
select split_id, split_workout_id from workouts where id = 'sw1';
\echo '--- T46 owner saves reminder settings; others cannot see them (expect 1, then 0):'
insert into reminder_settings(user_id, tz, remind_at) values (:'C', 'UTC',
  case when (now() at time zone 'UTC')::time >= '00:10' then ((now() at time zone 'UTC')::time - interval '10 minutes')::time else '00:00' end);
select count(*) from reminder_settings;
select pg_temp.as_user(:'B'); select count(*) from reminder_settings where user_id = :'C';
\echo '--- T47 users cannot run the reminder functions (expect 2 permission ERRORs):'
select * from due_reminders();
select mark_reminded(:'C', current_date);
\echo '--- T48 due: past reminder time, nothing logged today (expect C listed, count 1):'
reset role; set role service_role;
select count(*) from due_reminders() where user_id = :'C';
\echo '--- T49 only once a day: after mark_reminded (expect 0):'
select mark_reminded(:'C', (now() at time zone 'UTC')::date);
select count(*) from due_reminders() where user_id = :'C';
\echo '--- T50 rest day skips it (expect 0):'
update reminder_settings set last_sent_day = null, rest_day = (now() at time zone 'UTC')::date where user_id = :'C';
select count(*) from due_reminders() where user_id = :'C';
\echo '--- T51 a workout logged today skips it (expect 1 before, 0 after):'
update reminder_settings set rest_day = null where user_id = :'C';
select count(*) from due_reminders() where user_id = :'C';
insert into workouts(user_id, id, title, started_at, finished_at, local_day) values (:'C', 'today1', 'Walk', now(), now(), (now() at time zone 'UTC')::date);
select count(*) from due_reminders() where user_id = :'C';
\echo '--- T52 a bad time zone or a time not reached yet never breaks or fires (expect 0, 0):'
delete from workouts where id = 'today1';
insert into reminder_settings(user_id, tz) values (:'B', 'Mars/Olympus') on conflict (user_id) do update set tz = 'Mars/Olympus';
select count(*) from due_reminders() where user_id = :'B';
update reminder_settings set remind_at = ((now() at time zone 'UTC')::time + interval '1 hour')::time where user_id = :'C';
select count(*) from due_reminders() where user_id = :'C' and (now() at time zone 'UTC')::time < '23:00';

-- ───── v8: privacy, consent, monitoring, account deletion ─────
reset role; set role authenticated;
\echo '--- T53 others can read a username but not coach access (expect kelly, then permission ERROR):'
select pg_temp.as_user(:'B');
select username from profiles where id = :'A';
select coach_enabled from profiles where id = :'A';
\echo '--- T54 owner records consent; others cannot see it (expect 1, then 0):'
select pg_temp.as_user(:'A');
insert into consents(user_id, kind, version) values (:'A', 'ai_coach', 1);
select count(*) from consents;
select pg_temp.as_user(:'B'); select count(*) from consents where user_id = :'A';
\echo '--- T55 consent log is append-only: no edits, no deletes (expect 2 permission ERRORs):'
select pg_temp.as_user(:'A');
update consents set granted = false where user_id = :'A';
delete from consents where user_id = :'A';
\echo '--- T56 consents cannot be backdated or recorded for someone else (expect 2 RLS ERRORs):'
insert into consents(user_id, kind, version, at) values (:'A', 'health_data', 1, now() - interval '1 year');
insert into consents(user_id, kind, version) values (:'B', 'health_data', 1);
\echo '--- T57 users cannot read or write error logs or uptime data (expect 0, RLS ERROR, 0):'
select count(*) from error_events;
insert into error_events(source, kind, message) values ('app', 'x', 'y');
select count(*) from uptime_pings;
\echo '--- T58 users cannot call the account-deletion helper (expect permission ERROR):'
select delete_account_data(:'B');
\echo '--- T59 before deletion, Bestie has rows across the app (expect > 0):'
reset role;
create or replace function pg_temp.refs(p uuid) returns bigint language plpgsql as $$
declare r record; n bigint := 0; c bigint;
begin
  for r in select table_name, column_name from information_schema.columns
           where table_schema = 'public' and data_type = 'uuid'
             and column_name in ('user_id', 'requester', 'addressee', 'created_by', 'id')
             and table_name not in ('challenges') or (table_schema = 'public' and table_name = 'challenges' and column_name = 'created_by')
  loop
    execute format('select count(*) from public.%I where %I = $1', r.table_name, r.column_name) into c using p;
    n := n + c;
  end loop;
  select count(*) into c from public.activity where payload ->> 'to' = p::text;
  return n + c;
end $$;
insert into activity(challenge_id, user_id, kind, payload)
  select id, :'A', 'nudge', jsonb_build_object('to', :'B') from challenges limit 1;
select pg_temp.refs(:'B') > 0 as has_rows;
\echo '--- T60 server deletes the account (expect no ERROR):'
set role service_role;
select delete_account_data(:'B');
reset role;
delete from auth.users where id = :'B';
\echo '--- T61 after deletion, nothing anywhere references Bestie (expect 0):'
select pg_temp.refs(:'B');
\echo '--- T62 Kelly keeps her own data (expect > 0):'
select pg_temp.refs(:'A') > 0 as kelly_intact;
