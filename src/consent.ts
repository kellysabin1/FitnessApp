// Consent (REP-6). Every agreement is recorded with a version and timestamp in the account's consent log
// (supabase `consents`, append-only). The latest answer per kind wins, so consent can be withdrawn.
// Bump a version when that text changes materially — people are asked again.
import { type ConsentKind, type ConsentRecord, useStore } from './store';
import { sb } from './social/supabase';

export const CONSENT_VERSION: Record<ConsentKind, number> = {
  terms_privacy: 1,
  health_data: 1,
  ai_coach: 1, // keep in step with AI_CONSENT_VERSION in server/src/index.ts
  challenge_sharing: 1,
};

export const hasConsent = (kind: ConsentKind, consents = useStore.getState().consents) => {
  const c = consents[kind];
  return !!c?.granted && c.version >= CONSENT_VERSION[kind];
};

/** Terms + privacy + health data: needed before using the app. */
export const hasCoreConsent = (consents = useStore.getState().consents) =>
  hasConsent('terms_privacy', consents) && hasConsent('health_data', consents);

/** Record an answer locally right away, and in the account log (or queue it until the profile exists). */
export async function recordConsent(kind: ConsentKind, granted = true, context?: string) {
  const rec: ConsentRecord = { version: CONSENT_VERSION[kind], granted, at: new Date().toISOString() };
  const st = useStore.getState();
  useStore.setState({ consents: { ...st.consents, [kind]: rec } });
  const acct = st.account;
  const c = sb();
  if (!c || !acct?.username) {
    useStore.setState({ pendingConsents: [...useStore.getState().pendingConsents, { ...rec, kind, context }] });
    return;
  }
  const { error } = await c
    .from('consents')
    .insert({ user_id: acct.userId, kind, version: rec.version, granted, context: context ?? null });
  if (error) useStore.setState({ pendingConsents: [...useStore.getState().pendingConsents, { ...rec, kind, context }] });
}

/** Save queued consents (e.g. given at sign-up, before the @username/profile existed). Never throws. */
export async function flushPendingConsents() {
  const st = useStore.getState();
  const c = sb();
  if (!c || !st.account?.username || !st.pendingConsents.length) return;
  const rows = st.pendingConsents.map((p) => ({
    user_id: st.account!.userId,
    kind: p.kind,
    version: p.version,
    granted: p.granted,
    context: p.context ?? null,
  }));
  // consent rows are timestamped by the database (must be "now"), so they're saved as of now
  const { error } = await c.from('consents').insert(rows);
  if (!error) useStore.setState({ pendingConsents: [] });
}

/** Bring the latest answers down from the account (new phone / reinstall). */
export async function pullConsents() {
  const c = sb();
  const acct = useStore.getState().account;
  if (!c || !acct) return;
  const { data, error } = await c.from('consents').select('kind, version, granted, at').eq('user_id', acct.userId).order('at');
  if (error || !data) return;
  const latest: Partial<Record<ConsentKind, ConsentRecord>> = {};
  for (const r of data as { kind: ConsentKind; version: number; granted: boolean; at: string }[])
    latest[r.kind] = { version: r.version, granted: r.granted, at: r.at };
  // keep anything answered on this phone that hasn't reached the account yet
  for (const p of useStore.getState().pendingConsents) latest[p.kind] = { version: p.version, granted: p.granted, at: p.at };
  useStore.setState({ consents: latest });
}
