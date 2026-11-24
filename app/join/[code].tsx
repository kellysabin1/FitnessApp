import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Body, Button, Card, Display, Eyebrow, H2, Italic, Screen } from '@/src/components/ui';
import { joinChallenge } from '@/src/social/api';
import { useStore } from '@/src/store';
import { colors, space } from '@/src/theme';

/** Invite links land here: rep-app…/join/ABC123 */
export default function JoinFromLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const onboarded = useStore((s) => s.onboarded);
  const account = useStore((s) => s.account);
  const [err, setErr] = useState<string | null>(null);
  const ready = onboarded && !!account?.username;

  // Not set up yet? Remember the code so they land in the challenge right after setup.
  useEffect(() => {
    if (!ready && code) useStore.setState({ pendingInvite: String(code).toUpperCase() });
  }, [ready, code]);

  // joining shares challenge-day workouts and steps, so it takes a tap — never automatic
  const [busy, setBusy] = useState(false);
  const join = () => {
    if (!code) return;
    setBusy(true);
    useStore.setState({ pendingInvite: undefined });
    joinChallenge(code)
      .then((id) => router.replace({ pathname: '/challenge/[id]', params: { id } }))
      .catch((e) => {
        setErr((e as Error).message);
        setBusy(false);
      });
  };

  return (
    <Screen>
      <Eyebrow>You’re invited</Eyebrow>
      <Display style={{ marginTop: space(2) }}>
        Join the <Italic>challenge.</Italic>
      </Display>
      <Card tone="croc" style={{ marginTop: space(6), gap: space(3) }}>
        <H2>Code {String(code ?? '').toUpperCase()}</H2>
        {err ? (
          <Body style={{ color: colors.sand }}>{err}</Body>
        ) : !onboarded ? (
          <>
            <Body muted>First, set up rep. — it takes a minute. You’ll join the challenge right after.</Body>
            <Button title="Set up rep." onPress={() => router.replace('/welcome')} />
          </>
        ) : !account?.username ? (
          <>
            <Body muted>Create an account (or sign in) — you’ll join the challenge right after.</Body>
            <Button title="Create account / sign in" onPress={() => router.replace('/welcome')} />
          </>
        ) : (
          <>
            <Body muted style={{ fontSize: 14 }}>
              Members will see your workouts (exercises, sets, weights, reps) and daily steps from the challenge dates only — never your
              body measurements. Leave any time.
            </Body>
            <Button title="Join challenge" icon="trophy-outline" loading={busy} onPress={join} />
            <Button title="Not now" variant="ghost" small onPress={() => router.replace('/')} />
          </>
        )}
      </Card>
    </Screen>
  );
}
