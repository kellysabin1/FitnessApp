import { expect, type Page, test as base } from '@playwright/test';

export const MOCK = 'http://127.0.0.1:5998';
export const lb = (x: number) => x * 0.45359237;
export const STORE_KEY = 'rep-store-v1';
export const AUTH_KEY = 'sb-127-auth-token';

export const daysAgo = (n: number, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const agreed = { version: 1, granted: true, at: '2026-11-01T00:00:00.000Z' };
/** What an existing account has agreed to (terms + health data; not the AI coach). */
export const CORE_CONSENTS = { terms_privacy: agreed, health_data: agreed };
export const ALL_CONSENTS = { ...CORE_CONSENTS, ai_coach: agreed };

export const PROFILE = { name: 'Kelly', goals: [], experience: 'intermediate', daysPerWeek: 4, stepGoal: 8000, equipment: '', notes: '' };
export const ACCOUNT = { userId: 'uA', email: 'kelly@example.com', username: 'kelly', displayName: 'Kelly' };

/** A signed-in session for the mock's "kelly" account. */
export const SESSION = () => ({
  access_token: 'tok-kelly',
  refresh_token: 'r',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'uA', aud: 'authenticated' },
});

export async function mockState() {
  return (await fetch(`${MOCK}/__state`)).json();
}

type Fixtures = {
  /** fail the test on any uncaught page error */
  pageErrors: string[];
  /** put data on "the phone" as a signed-in user, then open a path */
  seed: (state: Record<string, unknown>, path?: string) => Promise<void>;
  /** read the app's saved state from the phone */
  store: () => Promise<any>;
};

export const test = base.extend<Fixtures>({
  pageErrors: [
    async ({ page }, use) => {
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(e.message));
      // the live security policy (render.yaml) must never block the app
      page.on('console', (m) => {
        if (/Content Security Policy|Refused to (load|connect|execute|apply)/i.test(m.text())) errs.push(m.text());
      });
      await use(errs);
      expect(errs, 'uncaught errors in the app').toEqual([]);
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    await fetch(`${MOCK}/__reset`);
    page.on('dialog', (d) => d.accept());
    await use(page);
  },
  seed: async ({ page }, use) => {
    await use(async (state, path = '/') => {
      await page.goto('/');
      await page.evaluate(
        ([key, authKey, s, session]) => {
          localStorage.setItem(key, JSON.stringify({ state: s, version: 0 }));
          localStorage.setItem(authKey, JSON.stringify(session));
        },
        [
          STORE_KEY,
          AUTH_KEY,
          {
            onboarded: true,
            units: 'us',
            profile: PROFILE,
            workouts: [],
            body: [],
            health: {},
            coach: [],
            pendingDeletes: [],
            pendingBodyDeletes: [],
            customExercises: [],
            splits: [],
            targets: [],
            server: { url: '', token: '' },
            account: ACCOUNT,
            dataOwner: 'uA',
            consents: CORE_CONSENTS,
            userDataUpdatedAt: '2026-11-20T00:00:00.000Z',
            ...state,
          },
          SESSION(),
        ] as const,
      );
      await page.goto(path);
    });
  },
  store: async ({ page }, use) => {
    await use(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').state ?? {}, STORE_KEY));
  },
});

export { expect };
export type { Page };
