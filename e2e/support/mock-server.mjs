// Test stand-in for everything rep. talks to over the network: Supabase (auth + REST + RPCs) and the
// rep-coach server. Deterministic, in-memory, and reset between tests via GET /__reset.
// Never used in production. Usage: node e2e/support/mock-server.mjs [port]
import http from 'node:http';

const PORT = Number(process.argv[2] ?? 5998);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let db;
function fresh() {
  return {
    users: {
      // an existing account with data "in the cloud"
      kelly: { id: 'uA', email: 'kelly@example.com', password: 'secret123', token: 'tok-kelly' },
      // a user with a real-format id, for server tests that go through supabase-js admin calls
      tess: { id: '00000000-0000-4000-8000-0000000000aa', email: 'tess@example.com', password: 'secret123', token: 'tok-tess' },
    },
    profiles: { uA: { id: 'uA', username: 'kelly', display_name: 'Kelly', consented_at: '2026-11-01T00:00:00.000Z', consent_version: 1 } },
    userData: {
      uA: {
        user_id: 'uA',
        profile: {
          name: 'Kelly R',
          goals: ['recomp'],
          experience: 'intermediate',
          daysPerWeek: 4,
          stepGoal: 9000,
          equipment: 'Full gym',
          notes: '',
        },
        settings: { units: 'us' },
        custom_exercises: [{ name: 'Banded Walk', kind: 'bodyweight', category: 'strength', muscle: 'Strength', custom: true }],
        splits: [],
        targets: [],
        updated_at: '2026-11-10T10:00:00.000Z',
      },
    },
    body: {
      uA: [
        {
          id: 'b1',
          day: '2026-11-10',
          weight_kg: 64.5,
          body_fat_pct: null,
          waist_cm: null,
          hips_cm: null,
          updated_at: '2026-11-10T10:00:00.000Z',
        },
      ],
    },
    workouts: {},
    reminders: {},
    // the existing account already agreed to the terms and to health data being stored
    consents: [
      { user_id: 'uA', kind: 'terms_privacy', version: 1, granted: true, context: null, at: '2026-11-01T00:00:00.000Z' },
      { user_id: 'uA', kind: 'health_data', version: 1, granted: true, context: null, at: '2026-11-01T00:00:00.000Z' },
    ],
    joined: [],
    checks: [],
    deleted: [],
    errors: [],
    log: [],
    nextUser: 1,
  };
}
db = fresh();

const challenge = () => ({
  id: 'c1',
  name: 'November lift club',
  created_by: 'uA',
  starts_on: today(),
  ends_on: '2099-01-01',
  invite_code: 'ABC123',
  score_workouts: true,
  score_steps: true,
  score_streaks: true,
  score_plan: true,
  step_goal: 8000,
  mode: 'any',
  description: 'Lift together, keep it fun.',
  plan: [],
  tasks: ['Drink 3 L water', 'Stretch 10 min'],
});

const NO_ROW = { code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows' };

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        return res.end();
      }
      const send = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json', ...cors });
        res.end(obj === undefined ? '' : JSON.stringify(obj));
      };
      const url = new URL(req.url, 'http://x');
      const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
      const me = Object.values(db.users).find((u) => u.token === tok);
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        return send(400, { message: 'bad json' });
      }
      const single = (req.headers.accept || '').includes('vnd.pgrst.object');
      const eq = (k) => (url.searchParams.get(k) || '').replace(/^eq\./, '');
      const one = (row) => (single ? (row ? send(200, row) : send(406, NO_ROW)) : send(200, row ? [row] : []));
      const first = (b) => (Array.isArray(b) ? b[0] : b);
      const session = (u) => ({
        access_token: u.token,
        refresh_token: 'r-' + u.id,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: u.id, email: u.email, aud: 'authenticated' },
      });

      // ── test controls
      if (url.pathname === '/__reset') {
        db = fresh();
        return send(200, { ok: true });
      }
      if (url.pathname === '/__state') return send(200, db);

      // ── rep-coach server stand-ins
      if (url.pathname === '/reminders/status') return send(200, { push: true, email: false });
      if (url.pathname === '/push/public-key') return send(503, { error: 'Notifications not configured' });
      if (url.pathname === '/coach/access') return send(200, { enabled: !!me, limits: { chats: 30, plans: 5 } });
      if (url.pathname === '/errors') {
        db.errors.push(body);
        return send(204);
      }
      if (url.pathname === '/account/delete') {
        if (!me) return send(401, { error: 'Sign in again' });
        if (body?.password !== me.password) return send(403, { error: 'That password isn’t right.' });
        db.deleted.push(me.id);
        delete db.profiles[me.id];
        delete db.userData[me.id];
        delete db.body[me.id];
        delete db.reminders[me.id];
        db.consents = db.consents.filter((c) => c.user_id !== me.id);
        for (const k of Object.keys(db.users)) if (db.users[k].id === me.id) delete db.users[k];
        return send(200, { deleted: true });
      }

      // ── auth
      if (url.pathname === '/auth/v1/signup') {
        const id = 'uN' + db.nextUser++;
        const u = { id, email: body.email, password: body.password, token: 'tok-' + id };
        db.users[id] = u;
        db.log.push({ op: 'signup', email: u.email });
        return send(200, session(u));
      }
      if (url.pathname === '/auth/v1/token') {
        const u = Object.values(db.users).find((x) => x.email === body?.email && x.password === body?.password);
        return u
          ? send(200, session(u))
          : send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      }
      if (url.pathname === '/auth/v1/user')
        return me ? send(200, { id: me.id, email: me.email, aud: 'authenticated' }) : send(401, { msg: 'invalid JWT' });
      if (url.pathname === '/auth/v1/logout') return send(204);
      // service-role admin calls (used by rep-coach tests)
      if (url.pathname.startsWith('/auth/v1/admin/users/') && req.method === 'GET') {
        const u = Object.values(db.users).find((x) => x.id === url.pathname.split('/').pop());
        return u ? send(200, { id: u.id, email: u.email, aud: 'authenticated' }) : send(404, { msg: 'User not found' });
      }
      if (url.pathname.startsWith('/auth/v1/admin/users/') && req.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        db.deleted.push(id);
        for (const k of Object.keys(db.users)) if (db.users[k].id === id) delete db.users[k];
        return send(200, {});
      }

      // ── REST
      const table = url.pathname.replace('/rest/v1/', '');
      if (req.method !== 'GET' && !url.pathname.startsWith('/rest/v1/rpc/'))
        db.log.push({ op: req.method, table, rows: Array.isArray(body) ? body.length : body ? 1 : 0, sample: first(body) });

      if (table === 'profiles') {
        if (req.method === 'POST' || req.method === 'PATCH') {
          const r = first(body);
          const id = r.id ?? eq('id');
          db.profiles[id] = { ...(db.profiles[id] ?? {}), ...r, id };
          return send(201);
        }
        const id = eq('id');
        const row = db.profiles[id];
        if (url.searchParams.get('select')?.includes('coach_enabled')) return send(200, { coach_enabled: id === 'uA' });
        return one(row);
      }
      if (table === 'user_data') {
        if (req.method === 'POST') {
          const r = first(body);
          db.userData[r.user_id] = r;
          return send(201);
        }
        return one(db.userData[eq('user_id')]);
      }
      if (table === 'body_entries') {
        if (req.method === 'POST' || req.method === 'DELETE') return send(201);
        return send(200, db.body[eq('user_id')] ?? []);
      }
      if (table === 'workouts') {
        if (req.method === 'POST') {
          for (const r of Array.isArray(body) ? body : [body]) (db.workouts[r.user_id] ??= {})[r.id] = r;
          return send(201);
        }
        if (req.method === 'DELETE') return send(204);
        return send(200, Object.values(db.workouts[eq('user_id')] ?? {}));
      }
      if (['daily_steps', 'activity', 'friendships', 'push_subscriptions', 'challenge_members', 'reactions'].includes(table)) {
        return req.method === 'GET' ? send(200, []) : send(201);
      }
      if (table === 'challenges') return single ? send(200, challenge()) : send(200, [challenge()]);
      if (table === 'task_checks') {
        if (req.method === 'POST') {
          db.checks.push(first(body));
          return send(201);
        }
        if (req.method === 'DELETE') {
          const i = db.checks.findIndex((c) => String(c.task_index) === eq('task_index'));
          if (i >= 0) db.checks.splice(i, 1);
          return send(204);
        }
        return send(
          200,
          db.checks.filter((c) => c.user_id === eq('user_id') && c.day === eq('day')).map((c) => ({ task_index: c.task_index })),
        );
      }
      if (table === 'consents') {
        if (req.method === 'POST') {
          for (const r of Array.isArray(body) ? body : [body])
            db.consents.push({ granted: true, context: null, ...r, at: new Date().toISOString() });
          return send(201);
        }
        return send(
          200,
          db.consents.filter((c) => c.user_id === eq('user_id')),
        );
      }
      if (url.pathname === '/rest/v1/rpc/delete_account_data') return send(204);
      if (table === 'error_events') {
        if (req.method === 'POST') db.errors.push(first(body));
        return req.method === 'GET' ? send(200, []) : send(201);
      }
      if (table === 'app_secrets') return single ? send(406, NO_ROW) : send(200, []);
      if (url.pathname === '/rest/v1/rpc/join_challenge') {
        db.joined.push(body?.p_code);
        return send(200, 'c1');
      }
      if (table === 'reminder_settings') {
        if (req.method !== 'GET') {
          const r = first(body);
          db.reminders[r.user_id] = {
            ...(db.reminders[r.user_id] ?? { push: true, email: false, remind_at: '20:00:00', rest_day: null }),
            ...r,
          };
          return send(201);
        }
        return one(db.reminders[eq('user_id')]);
      }
      if (url.pathname === '/rest/v1/rpc/challenge_leaderboard') {
        const n = db.checks.length;
        return send(200, [
          {
            user_id: 'uA',
            username: 'kelly',
            display_name: 'Kelly',
            workouts: 0,
            steps: 0,
            streak_days: 0,
            plan_done: 0,
            current_streak: 0,
            points: n * 2,
            pts_workouts: 0,
            pts_steps: 0,
            pts_streaks: 0,
            pts_plan: 0,
            goal_days: 0,
            tasks_done: n,
            pts_tasks: n * 2,
          },
        ]);
      }
      send(404, { message: 'mock: unknown ' + req.method + ' ' + url.pathname });
    });
  })
  .listen(PORT, () => console.log(`rep. mock backend on ${PORT}`));
