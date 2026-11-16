// Oura Ring — OAuth2 + API v2.
// The login happens in the browser (expo-auth-session); the code→token exchange
// happens on our server so the Oura client secret never ships inside the app.
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { HealthDay, OuraAuth } from '../store';
import { todayKey, useStore } from '../store';
import { serverPost } from '../api';

WebBrowser.maybeCompleteAuthSession();

const OURA_AUTHORIZE = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_API = 'https://api.ouraring.com/v2/usercollection';
export const OURA_CLIENT_ID = process.env.EXPO_PUBLIC_OURA_CLIENT_ID ?? '';

export const ouraRedirectUri = () => AuthSession.makeRedirectUri({ scheme: 'rep', path: 'oura' });

export async function connectOura(): Promise<OuraAuth> {
  if (!OURA_CLIENT_ID) throw new Error('Oura client ID is not set (EXPO_PUBLIC_OURA_CLIENT_ID).');
  const redirectUri = ouraRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: OURA_CLIENT_ID,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['personal', 'daily', 'heartrate', 'workout'],
    usePKCE: false,
  });
  const result = await request.promptAsync({ authorizationEndpoint: OURA_AUTHORIZE });
  if (result.type !== 'success' || !result.params.code) throw new Error('Oura sign-in was cancelled.');
  const tokens = await serverPost<TokenResponse>('/oura/token', { code: result.params.code, redirectUri });
  return toAuth(tokens);
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

const toAuth = (t: TokenResponse): OuraAuth => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token,
  expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
});

async function validToken(): Promise<string> {
  const { oura, set } = useStore.getState();
  if (!oura) throw new Error('Oura is not connected.');
  if (oura.expiresAt && oura.expiresAt - Date.now() < 60_000 && oura.refreshToken) {
    const t = await serverPost<TokenResponse>('/oura/refresh', { refreshToken: oura.refreshToken });
    const next = toAuth(t);
    set({ oura: next });
    return next.accessToken;
  }
  return oura.accessToken;
}

async function get<T>(path: string, start: string, end: string): Promise<T[]> {
  const token = await validToken();
  const res = await fetch(`${OURA_API}/${path}?start_date=${start}&end_date=${end}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('Oura session expired — reconnect Oura.');
  if (!res.ok) throw new Error(`Oura ${path} failed (${res.status})`);
  const json = (await res.json()) as { data: T[] };
  return json.data ?? [];
}

export async function fetchOuraDays(days = 7): Promise<HealthDay[]> {
  const startD = new Date();
  startD.setDate(startD.getDate() - (days - 1));
  const start = todayKey(startD);
  // end_date is exclusive on some endpoints — ask for tomorrow to include today
  const endD = new Date();
  endD.setDate(endD.getDate() + 1);
  const end = todayKey(endD);

  const [readiness, sleepDaily, activity, sleeps] = await Promise.all([
    get<{ day: string; score?: number }>('daily_readiness', start, end),
    get<{ day: string; score?: number }>('daily_sleep', start, end),
    get<{ day: string; steps?: number; active_calories?: number }>('daily_activity', start, end),
    get<{
      day: string;
      type?: string;
      total_sleep_duration?: number;
      average_hrv?: number;
      lowest_heart_rate?: number;
    }>('sleep', start, end),
  ]);

  const byDay = new Map<string, HealthDay>();
  const day = (d: string) => {
    if (!byDay.has(d)) byDay.set(d, { date: d, source: 'oura' });
    return byDay.get(d)!;
  };
  for (const r of readiness) day(r.day).readiness = r.score;
  for (const s of sleepDaily) day(s.day).sleepScore = s.score;
  for (const a of activity) {
    day(a.day).steps = a.steps;
    day(a.day).activeKcal = a.active_calories;
  }
  for (const s of sleeps) {
    if (s.type && s.type !== 'long_sleep') continue; // skip naps
    const d = day(s.day);
    if (s.total_sleep_duration) d.sleepHours = Math.round((s.total_sleep_duration / 3600) * 10) / 10;
    if (s.average_hrv) d.hrvMs = Math.round(s.average_hrv);
    if (s.lowest_heart_rate) d.restingHr = s.lowest_heart_rate;
  }
  return [...byDay.values()];
}
