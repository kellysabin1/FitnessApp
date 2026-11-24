import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Body, Button, Display, Eyebrow, Field, Heart, Italic, Row, Screen } from '@/src/components/ui';
import { restoreSession } from '@/src/social/api';
import { friendly, requireSb } from '@/src/social/supabase';
import { colors, space } from '@/src/theme';

type Stage = 'checking' | 'ready' | 'bad-link' | 'done';

/** Where the "reset your password" email link lands (…/reset-password#access_token=…&type=recovery). */
export default function ResetPassword() {
  // read the recovery tokens from the link once, on first render
  const [link] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (params.get('error') || params.get('type') !== 'recovery' || !access_token || !refresh_token) return null;
    return { access_token, refresh_token };
  });
  const [stage, setStage] = useState<Stage>(link ? 'checking' : 'bad-link');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // don't leave tokens sitting in the address bar or browser history
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
    if (!link) return;
    requireSb()
      .auth.setSession(link)
      .then(({ error }) => setStage(error ? 'bad-link' : 'ready'))
      .catch(() => setStage('bad-link'));
  }, [link]);

  const save = async () => {
    if (password.length < 8) return setErr('Use at least 8 characters.');
    if (password !== again) return setErr('The two passwords don’t match.');
    setBusy(true);
    setErr(null);
    const { error } = await requireSb().auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setErr(friendly(error));
    }
    setStage('done');
    await restoreSession().catch(() => {});
    setBusy(false);
  };

  return (
    <Screen contentStyle={{ gap: space(5) }}>
      <Row gap={2}>
        <Heart size={14} />
        <Eyebrow>Your account</Eyebrow>
      </Row>
      <Display>
        New <Italic>password.</Italic>
      </Display>
      {stage === 'checking' ? <Body muted>Checking your link…</Body> : null}
      {stage === 'bad-link' ? (
        <>
          <Body muted>This reset link has expired or was already used. Ask for a new one from the sign-in screen.</Body>
          <Button title="Back to sign in" onPress={() => router.replace('/welcome')} />
        </>
      ) : null}
      {stage === 'ready' ? (
        <>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Field label="Type it again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" />
          <Button title="Save new password" loading={busy} disabled={!password || !again} onPress={save} />
          {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
        </>
      ) : null}
      {stage === 'done' ? (
        <>
          <Body>Password updated — you’re signed in.</Body>
          <Button title="Open rep." onPress={() => router.replace('/')} />
        </>
      ) : null}
    </Screen>
  );
}
