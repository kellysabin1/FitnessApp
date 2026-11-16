import { useStore } from './store';

export class ServerNotConfigured extends Error {
  constructor() {
    super('Coach not set up yet. Add the coach link and password in You → Coach.');
  }
}

export const isCoachConfigured = (server: { url: string; token: string }) =>
  !!server.url.trim() && !!server.token.trim();

const clean = (url: string) => url.trim().replace(/\/$/, '');

/** Check that the coach link is reachable and the password is right. */
export async function testCoachConnection(url: string, token: string): Promise<'ok' | 'unauthorized' | 'unreachable'> {
  try {
    const res = await fetch(clean(url) + '/auth-check', { headers: { Authorization: `Bearer ${token.trim()}` } });
    if (res.status === 401) return 'unauthorized';
    return res.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

/** POST JSON to the rep. backend (holds the Claude key + Oura secret). */
export async function serverPost<T>(path: string, body: unknown): Promise<T> {
  const { url, token } = useStore.getState().server;
  if (!isCoachConfigured({ url, token })) throw new ServerNotConfigured();
  const res = await fetch(clean(url) + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) useStore.getState().set({ coachStatus: 'unauthorized' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Server error (${res.status})`);
  return json as T;
}
