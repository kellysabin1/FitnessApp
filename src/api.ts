import { useStore } from './store';

export class ServerNotConfigured extends Error {
  constructor() {
    super('Your coach server isn’t set up yet. Add its URL in You → Coach server.');
  }
}

/** POST JSON to the Velour backend (holds the Claude key + Oura secret). */
export async function serverPost<T>(path: string, body: unknown): Promise<T> {
  const { url, token } = useStore.getState().server;
  if (!url) throw new ServerNotConfigured();
  const res = await fetch(url.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Server error (${res.status})`);
  return json as T;
}
