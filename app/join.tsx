import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, Screen } from '@/src/components/ui';
import { joinChallenge } from '@/src/social/api';
import { colors, space } from '@/src/theme';

export default function JoinWithCode() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setErr(null);
    try {
      const id = await joinChallenge(code);
      router.replace({ pathname: '/challenge/[id]', params: { id } });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5) }}>
      <Body muted>Type the 6-character code your friend sent you.</Body>
      <Field
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        placeholder="A1B2C3"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
      />
      <Button title="Join challenge" loading={busy} disabled={code.length !== 6} onPress={join} />
      {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
    </Screen>
  );
}
