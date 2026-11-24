// Crash & error reporting (REP-11). Sends the error's type, message, stack frames and screen path to
// rep-coach, which scrubs personal data (emails, ids, tokens, all numbers) before storing it.
// Never sends app data, health values, or who you are.
import { Platform } from 'react-native';
import { PUSH_SERVER_URL } from './config';

const RELEASE = '1.0.0';
const sent = new Set<string>();

export function reportError(e: unknown, where?: string) {
  try {
    const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'Unknown error');
    const key = `${err.name}:${err.message}`.slice(0, 200);
    if (sent.has(key) || sent.size >= 5 || !PUSH_SERVER_URL) return; // a few distinct errors per session is plenty
    sent.add(key);
    const route = where ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : undefined);
    void fetch(`${PUSH_SERVER_URL.replace(/\/$/, '')}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: err.name || 'Error',
        message: err.message.slice(0, 2000),
        stack: err.stack?.slice(0, 20_000),
        route,
        release: RELEASE,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // reporting must never cause a second error
  }
}

/** Catch errors that escape React (web). */
export function watchGlobalErrors() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
}
