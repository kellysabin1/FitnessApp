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
