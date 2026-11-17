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

  useEffect(() => {
    if (!ready || !code) return;
    joinChallenge(code)
      .then((id) => router.replace({ pathname: '/challenge/[id]', params: { id } }))
      .catch((e) => setErr((e as Error).message));
  }, [ready, code]);

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
            <Body muted>First, set up rep. — it takes a minute. Then open this link again.</Body>
            <Button title="Set up rep." onPress={() => router.replace('/onboarding')} />
          </>
        ) : !account?.username ? (
          <>
            <Body muted>Create an account (or sign in) to join. Then come back to this link.</Body>
            <Button title="Create account / sign in" onPress={() => router.push('/account')} />
          </>
        ) : (
          <Body muted>Joining…</Body>
        )}
      </Card>
    </Screen>
  );
}
