-- rep. — accounts, friends, challenges
-- Run this once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: it only creates things that don't exist yet.

create extension if not exists citext;

-- ───────────────────────── Profiles ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ───────────────────────── Friends ─────────────────────────
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- one friendship per pair, whichever direction it was sent
create unique index if not exists friendships_pair on public.friendships
  (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "send friend request" on public.friendships;
create policy "send friend request" on public.friendships
  for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "accept friend request" on public.friendships;
create policy "accept friend request" on public.friendships
  for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
drop policy if exists "remove friendship" on public.friendships;
create policy "remove friendship" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- ───────────────────────── Challenges ─────────────────────────
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  score_workouts boolean not null default true,
  score_steps boolean not null default true,
  score_streaks boolean not null default true,
  score_plan boolean not null default true,
  step_goal integer not null default 8000 check (step_goal between 1000 and 50000),
  -- shared plan: [{ "title": "Glutes & hamstrings", "exercises": ["Hip Thrust", ...] }, ...]
  plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;

-- v2: challenge type.
--   'any'  = every workout members log counts (a plan, if any, earns bonus points)
--   'plan' = only workouts from the group plan count
alter table public.challenges add column if not exists mode text not null default 'any';
do $$ begin
  alter table public.challenges add constraint challenges_mode_check check (mode in ('any', 'plan'));
exception when duplicate_object then null; end $$;

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenge_members enable row level security;

create or replace function public.is_member(ch uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenge_members where challenge_id = ch and user_id = u);
$$;

-- true when two people are in at least one challenge together
create or replace function public.share_challenge(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_members m1
    join challenge_members m2 on m1.challenge_id = m2.challenge_id
    where m1.user_id = a and m2.user_id = b
  );
$$;

-- true when `viewer` and `owner` share a challenge that was running on day `d`
-- (challenge-mates only see each other's workouts/steps from inside the challenge dates)
create or replace function public.shared_on_day(viewer uuid, owner uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_members m1
    join challenge_members m2 on m1.challenge_id = m2.challenge_id
    join challenges c on c.id = m1.challenge_id
    where m1.user_id = viewer and m2.user_id = owner
      and d between c.starts_on and c.ends_on
  );
$$;

drop policy if exists "members see challenge" on public.challenges;
create policy "members see challenge" on public.challenges
  for select to authenticated using (public.is_member(id));
drop policy if exists "creator edits challenge" on public.challenges;
create policy "creator edits challenge" on public.challenges
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "creator deletes challenge" on public.challenges;
create policy "creator deletes challenge" on public.challenges
  for delete to authenticated using (created_by = auth.uid());

drop policy if exists "members see members" on public.challenge_members;
create policy "members see members" on public.challenge_members
  for select to authenticated using (public.is_member(challenge_id));
drop policy if exists "leave challenge" on public.challenge_members;
create policy "leave challenge" on public.challenge_members
  for delete to authenticated using (user_id = auth.uid());
-- joining/adding goes through the functions below

drop function if exists public.create_challenge(text, date, date, boolean, boolean, boolean, boolean, integer, jsonb);
create or replace function public.create_challenge(
  p_name text, p_starts_on date, p_ends_on date,
  p_score_workouts boolean, p_score_steps boolean, p_score_streaks boolean, p_score_plan boolean,
  p_step_goal integer, p_plan jsonb, p_mode text default 'any'
) returns public.challenges
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_mode = 'plan' and jsonb_array_length(coalesce(p_plan, '[]'::jsonb)) = 0 then
    raise exception 'A plan-only challenge needs at least one plan workout';
  end if;
  insert into challenges (name, created_by, starts_on, ends_on, score_workouts, score_steps,
                          score_streaks, score_plan, step_goal, plan, mode)
  values (p_name, auth.uid(), p_starts_on, p_ends_on, p_score_workouts, p_score_steps,
          -- in plan-only challenges the plan *is* the workout score, so no separate bonus
          p_score_streaks, p_score_plan and p_mode <> 'plan', p_step_goal, coalesce(p_plan, '[]'::jsonb), p_mode)
  returning * into c;
  insert into challenge_members (challenge_id, user_id) values (c.id, auth.uid());
  insert into activity (challenge_id, user_id, kind, payload) values (c.id, auth.uid(), 'created', '{}'::jsonb);
  return c;
end $$;

create or replace function public.join_challenge(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ch uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into ch from challenges where invite_code = upper(trim(p_code));
  if ch is null then raise exception 'No challenge with that code'; end if;
  if not exists (select 1 from challenge_members where challenge_id = ch and user_id = auth.uid()) then
    insert into challenge_members (challenge_id, user_id) values (ch, auth.uid());
    insert into activity (challenge_id, user_id, kind, payload) values (ch, auth.uid(), 'joined', '{}'::jsonb);
  end if;
  return ch;
end $$;

-- a member can pull an accepted friend straight into a challenge
create or replace function public.add_friend_to_challenge(p_challenge uuid, p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_challenge, auth.uid()) then raise exception 'not in this challenge'; end if;
  if not are_friends(auth.uid(), p_friend) then raise exception 'you can only add friends'; end if;
  insert into challenge_members (challenge_id, user_id) values (p_challenge, p_friend)
    on conflict do nothing;
  insert into activity (challenge_id, user_id, kind, payload)
    values (p_challenge, p_friend, 'joined', jsonb_build_object('added_by', auth.uid()));
end $$;

-- ───────────────────────── Synced data ─────────────────────────
create table if not exists public.workouts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  id text not null,                         -- the phone's workout id
  title text not null default 'Workout',
  started_at timestamptz not null,
  finished_at timestamptz not null,
  local_day date not null,                  -- the day it happened in the user's own timezone
  duration_min integer not null default 0,
  sets_done integer not null default 0,
  volume_kg numeric not null default 0,
  plan_item text,                           -- title of the group-plan workout it completed, if any
  exercises jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists workouts_user_day on public.workouts (user_id, local_day);
alter table public.workouts enable row level security;

drop policy if exists "see own or challenge-mates workouts" on public.workouts;
create policy "see own or challenge-mates workouts" on public.workouts
  for select to authenticated using (user_id = auth.uid() or public.shared_on_day(auth.uid(), user_id, local_day));
drop policy if exists "write own workouts" on public.workouts;
create policy "write own workouts" on public.workouts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.daily_steps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  steps integer not null check (steps between 0 and 200000),
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_steps enable row level security;

drop policy if exists "see own or challenge-mates steps" on public.daily_steps;
create policy "see own or challenge-mates steps" on public.daily_steps
  for select to authenticated using (user_id = auth.uid() or public.shared_on_day(auth.uid(), user_id, day));
drop policy if exists "write own steps" on public.daily_steps;
create policy "write own steps" on public.daily_steps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── Activity feed ─────────────────────────
create table if not exists public.activity (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('created', 'joined', 'workout', 'steps', 'nudge')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_challenge on public.activity (challenge_id, created_at desc);
alter table public.activity enable row level security;

drop policy if exists "members read feed" on public.activity;
create policy "members read feed" on public.activity
  for select to authenticated using (public.is_member(challenge_id));
drop policy if exists "members post to feed" on public.activity;
create policy "members post to feed" on public.activity
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(challenge_id) and kind in ('workout', 'steps', 'nudge'));
drop policy if exists "delete own posts" on public.activity;
create policy "delete own posts" on public.activity
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.reactions (
  activity_id bigint not null references public.activity (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '🔥', '💪', '❤️')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id, emoji)
);
alter table public.reactions enable row level security;

create or replace function public.activity_challenge(a bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select challenge_id from activity where id = a;
$$;

drop policy if exists "members read reactions" on public.reactions;
create policy "members read reactions" on public.reactions
  for select to authenticated using (public.is_member(public.activity_challenge(activity_id)));
drop policy if exists "members react" on public.reactions;
create policy "members react" on public.reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(public.activity_challenge(activity_id)));
drop policy if exists "remove own reaction" on public.reactions;
create policy "remove own reaction" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── Notifications ─────────────────────────
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "manage own push subscriptions" on public.push_subscriptions;
create policy "manage own push subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Server-only settings (e.g. notification keys). No policies = only the server can read it.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;

-- ───────────────────────── Leaderboard ─────────────────────────
-- Points:
--   workouts  10 per finished workout (max 2 a day count)
--             in 'plan' challenges only workouts from the group plan count
--   steps     1 per 1,000 steps (max 20 a day) + 5 bonus on days you hit the step goal
--   streaks   +3 for every active day that follows another active day
--             (active = a workout, or the step goal hit)
--   plan      +5 bonus for each workout that completes an item of the group plan
create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (
  user_id uuid, username text, display_name text,
  workouts integer, steps bigint, streak_days integer, plan_done integer,
  current_streak integer, points integer
)
language plpgsql stable security definer set search_path = public as $$
declare c challenges;
begin
  if not is_member(p_challenge, auth.uid()) then raise exception 'not in this challenge'; end if;
  select * into c from challenges where id = p_challenge;
  return query
  with members as (
    select m.user_id, p.username::text as username, p.display_name
    from challenge_members m join profiles p on p.id = m.user_id
    where m.challenge_id = p_challenge
  ),
  w as (
    select wk.user_id, wk.local_day,
           count(*) filter (where c.mode = 'any' or (wk.plan_item is not null and exists (
             select 1 from jsonb_array_elements(c.plan) e where e->>'title' = wk.plan_item)))::int as n,
           count(*) filter (where wk.plan_item is not null and exists (
             select 1 from jsonb_array_elements(c.plan) e where e->>'title' = wk.plan_item))::int as plan_n
    from workouts wk
    where wk.user_id in (select m.user_id from members m)
      and wk.local_day between c.starts_on and least(c.ends_on, current_date + 1)
    group by wk.user_id, wk.local_day
  ),
  s as (
    select ds.user_id, ds.day as local_day, ds.steps
    from daily_steps ds
    where ds.user_id in (select m.user_id from members m)
      and ds.day between c.starts_on and least(c.ends_on, current_date + 1)
  ),
  days as (
    select coalesce(w.user_id, s.user_id) as user_id,
           coalesce(w.local_day, s.local_day) as d,
           coalesce(w.n, 0) as n,
           coalesce(w.plan_n, 0) as plan_n,
           coalesce(s.steps, 0) as steps
    from w full join s on w.user_id = s.user_id and w.local_day = s.local_day
  ),
  active as (
    select d.*, (d.n > 0 or (c.score_steps and d.steps >= c.step_goal)) as is_active
    from days d
  ),
  runs as (
    select a.*,
           (a.is_active and exists (
              select 1 from active b
              where b.user_id = a.user_id and b.d = a.d - 1 and b.is_active)) as continues
    from active a
  ),
  totals as (
    select r.user_id,
           sum(r.n)::int as workouts,
           sum(r.steps)::bigint as steps,
           count(*) filter (where r.continues)::int as streak_days,
           sum(r.plan_n)::int as plan_done,
           sum(least(r.n, 2) * case when c.score_workouts then 10 else 0 end
               + case when c.score_steps then least(r.steps / 1000, 20)
                        + case when r.steps >= c.step_goal then 5 else 0 end else 0 end
               + case when c.score_streaks and r.continues then 3 else 0 end
               + case when c.score_plan then r.plan_n * 5 else 0 end)::int as points
    from runs r group by r.user_id
  ),
  cur as (
    -- current streak: consecutive active days ending today or yesterday
    select a.user_id, count(*)::int as current_streak
    from active a
    -- a day counts if it was active and every day after it up to yesterday was active too
    -- (today not done yet doesn't break the streak)
    where a.is_active
      and a.d <= current_date
      and not exists (
        select 1 from generate_series(a.d, current_date - 1, interval '1 day') g
        where not exists (select 1 from active y where y.user_id = a.user_id and y.d = g::date and y.is_active)
      )
    group by a.user_id
  )
  select m.user_id, m.username, m.display_name,
         coalesce(t.workouts, 0), coalesce(t.steps, 0), coalesce(t.streak_days, 0),
         coalesce(t.plan_done, 0), coalesce(cur.current_streak, 0), coalesce(t.points, 0)
  from members m
  left join totals t on t.user_id = m.user_id
  left join cur on cur.user_id = m.user_id
  order by coalesce(t.points, 0) desc, m.username;
end $$;

-- Only signed-in users may call these (Supabase grants functions to everyone by default).
revoke execute on function public.create_challenge(text, date, date, boolean, boolean, boolean, boolean, integer, jsonb, text) from public, anon;
revoke execute on function public.join_challenge(text) from public, anon;
revoke execute on function public.add_friend_to_challenge(uuid, uuid) from public, anon;
revoke execute on function public.challenge_leaderboard(uuid) from public, anon;
grant execute on function public.create_challenge(text, date, date, boolean, boolean, boolean, boolean, integer, jsonb, text) to authenticated;
grant execute on function public.join_challenge(text) to authenticated;
grant execute on function public.add_friend_to_challenge(uuid, uuid) to authenticated;
grant execute on function public.challenge_leaderboard(uuid) to authenticated;
