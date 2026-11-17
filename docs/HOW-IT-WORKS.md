# How rep. works — the plain-English guide

## The big picture

rep. is made of **four pieces** that talk to each other:

| Piece | What it is | Where it lives | What it does |
|---|---|---|---|
| **The app** | What you see and tap | Render (as a website: **rep-app**) | Logging workouts, charts, the look & feel |
| **The coach server** | A small program running 24/7 | Render (**rep-coach**) | Talks to the AI, sends notifications |
| **The database** | Online storage | Supabase | Accounts, friends, challenges, shared workouts |
| **The code** | The instructions for all of the above | GitHub (**kellysabin1/FitnessApp**) | The master copy everything is built from |

Think of GitHub as the **recipe book**, Render as the **kitchen** that cooks the recipes and serves them,
and Supabase as the **pantry** where shared stuff is stored.

## The programming languages

- **TypeScript** — almost everything. It's JavaScript (the language of the web) with extra safety checks
  that catch mistakes before the app runs. Both the app and the coach server are written in it.
- **SQL** — the language of databases. Used once, in `supabase/schema.sql`, to set up the tables
  (like spreadsheets) and the privacy rules.
- Small amounts of **HTML/CSS** (web page basics) and **JSON** (settings files).

## The main tools ("frameworks")

- **React Native + Expo** — lets one set of code become an **iPhone app *and* a website**. Right now you
  use the website version; the same code becomes the real iPhone app later.
- **Expo Router** — handles moving between screens (each file in the `app/` folder is a screen).
- **Express** — a simple toolkit for building the coach server.
- **Claude (Anthropic)** — the AI behind the coach.
- **Supabase** — gives us the database, logins and privacy rules without running our own.

## Where things are "deployed" (put online)

- **Render** runs two things for you:
  - **rep-app** — the website version of rep. Free.
  - **rep-coach** — the coach server. Free plan (it naps after 15 minutes of no use, so the first request
    after a break is slow; $7/month removes that).
- **Supabase** hosts the database. Free plan.
- **Anthropic** charges for AI coach use from your prepaid credit (a few dollars a month for one person).

**How updates reach your phone:** when new code is saved to GitHub, Render notices and rebuilds
automatically (a few minutes). Close and reopen rep. to get it. The only exception: database changes
(`schema.sql`) have to be pasted into Supabase by hand.

## Where your data lives

- **On your phone:** everything you log is saved in the app itself, so it works offline.
  ⚠️ In the home-screen version, deleting the rep. icon deletes that copy.
- **In your account (Supabase):** once signed in, your finished workouts and steps are backed up, so you
  can sign in on a new phone and get them back.
- **What friends can see:** only people in a challenge with you, and only your workouts and steps from
  *inside that challenge's dates*. Strangers see nothing. These rules live in the database itself, so
  they can't be bypassed from the app.

## The secrets (keep private)

| Secret | Where it's stored | Never... |
|---|---|---|
| Anthropic API key | Render → rep-coach → Environment | ...paste it anywhere else |
| Coach password (APP_TOKEN) | Render → rep-coach → Environment, and in the app | ...post it publicly (anyone with it uses your AI credit) |
| Supabase secret key | Render → rep-coach → Environment | ...share it with anyone |

Safe to be public (and built into the app): the Supabase project URL and *publishable* key, and the
rep-coach address.

## The accounts you now own

- **GitHub** — the code
- **Render** — hosting the app and coach
- **Supabase** — the database
- **Anthropic Console** — the AI (has your spend limit)
- *(later)* **Apple Developer** — needed for the real iPhone app

## What's where in the code

```
app/          every screen (Today, Train, Progress, Friends, Coach, You, workouts, challenges…)
src/          shared building blocks: colours & fonts, data storage, charts, health connections
src/social/   accounts, friends, challenges, notifications
server/       the coach server (AI coach + notifications)
supabase/     database setup (schema.sql) and privacy tests (rls_test.sql)
assets/       icon, fonts, croc/tortoise/satin textures
public/       website extras (home-screen icon, notification helper)
```

## What's done vs. still to come

**Working now:** workout logging (live and after the fact), body & goals tracking, AI coach, accounts,
friends, challenges (any-workout or group-plan), leaderboards, feed, reactions, nudges, notifications.

**Needs the $99 Apple Developer account:** the real iPhone app, which unlocks **Apple Health,
RingConn and Oura** data, plus App Store distribution.

**Before inviting strangers / going public:** a privacy policy and terms (you handle health data),
licensed versions of any Pinterest images, and possibly paid hosting plans.
