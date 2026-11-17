// Lock-screen notifications from friends, using Web Push.
// Works in the home-screen web app on iPhone (iOS 16.4+) — no Apple Developer account needed.
import { Platform } from 'react-native';
import { PUSH_SERVER_URL } from '../config';
import { useStore } from '../store';
import { accessToken } from './api';
import { requireSb } from './supabase';

const serverUrl = () => (PUSH_SERVER_URL || useStore.getState().server.url).trim().replace(/\/$/, '');

export type PushState = 'unsupported' | 'needs-home-screen' | 'off' | 'denied' | 'on';

const isIos = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export async function pushState(): Promise<PushState> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs-home-screen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Ask permission, subscribe this device, and save it to the account. Must be called from a tap. */
export async function enablePush(): Promise<void> {
  const acct = useStore.getState().account;
  if (!acct) throw new Error('Sign in first.');
  if (!serverUrl()) throw new Error('Notifications aren’t set up on the rep. server yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are off. You can turn them on in iPhone Settings → Notifications → rep.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const res = await fetch(`${serverUrl()}/push/public-key`);
  if (!res.ok) throw new Error('Couldn’t reach the rep. server for notifications.');
  const { publicKey } = (await res.json()) as { publicKey: string };

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await requireSb()
    .from('push_subscriptions')
    .upsert({ endpoint: json.endpoint, user_id: acct.userId, p256dh: json.keys.p256dh, auth: json.keys.auth });
  if (error) throw new Error(error.message);
}

/** Ask the server to notify the right people about new feed items. Never throws. */
export async function notifyActivity(ids: number[]) {
  if (!ids.length || !serverUrl()) return;
  try {
    const token = await accessToken();
    if (!token) return;
    await fetch(`${serverUrl()}/push/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // notifications are a bonus — never block the workout on them
  }
}

/** Keep the service worker registered so notifications still arrive after updates. */
export async function registerServiceWorker() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* ignore */
  }
}
