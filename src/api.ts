import { PUSH_SERVER_URL, socialEnabled } from './config';
import { accessToken } from './social/api';
import { useStore } from './store';

export class ServerNotConfigured extends Error {
  constructor() {
    super('Sign in to use the coach (You → Account).');
  }
}

/** Legacy setup: a coach link + shared coach password typed into You → Coach. */
export const isCoachConfigured = (server: { url: string; token: string }) =>
  !!server.url.trim() && !!server.token.trim();

/** Signed-in users reach the coach with their rep. login — no link or password needed. */
export const usesAccountForCoach = () => socialEnabled() && !!useStore.getState().account?.username;

const clean = (url: string) => url.trim().replace(/\/$/, '');
const coachServer = () => clean(PUSH_SERVER_URL || useStore.getState().server.url);

/** Check that the coach link is reachable and the password is right (legacy setup). */
export async function testCoachConnection(url: string, token: string): Promise<'ok' | 'unauthorized' | 'unreachable'> {
  try {
    const res = await fetch(clean(url) + '/auth-check', { headers: { Authorization: `Bearer ${token.trim()}` } });
    if (res.status === 401) return 'unauthorized';
    return res.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export type CoachAccess = 'enabled' | 'no_access' | 'signed_out' | 'unreachable';

/** For signed-in users: does this account have coach access? */
export async function checkCoachAccess(): Promise<CoachAccess> {
  try {
    const token = await accessToken();
    if (!token) return 'signed_out';
    const res = await fetch(`${coachServer()}/coach/access`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) return 'signed_out';
    if (!res.ok) return 'unreachable';
    const json = (await res.json()) as { enabled?: boolean };
    return json.enabled ? 'enabled' : 'no_access';
  } catch {
    return 'unreachable';
  }
}

/** POST JSON to the rep. server (AI coach, Oura sign-in). Uses your login when signed in. */
export async function serverPost<T>(path: string, body: unknown): Promise<T> {
  let url: string;
  let auth: string;
  if (usesAccountForCoach()) {
    const token = await accessToken();
    if (!token) throw new Error('Sign in again to use the coach.');
    url = coachServer();
    auth = token;
  } else {
    const { url: u, token } = useStore.getState().server;
    if (!isCoachConfigured({ url: u, token })) throw new ServerNotConfigured();
    url = clean(u);
    auth = token.trim();
  }
  const res = await fetch(url + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (res.status === 401 && !usesAccountForCoach()) useStore.getState().set({ coachStatus: 'unauthorized' });
  if (res.status === 403 && json.code === 'no_access') useStore.getState().set({ coachStatus: 'no_access' });
  if (!res.ok) throw new Error(json.error ?? `Server error (${res.status})`);
  return json as T;
}
