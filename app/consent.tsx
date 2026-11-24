import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Checkbox, TextLink } from '@/src/components/Checkbox';
import { Body, Button, Display, Eyebrow, Heart, Italic, Row, Screen } from '@/src/components/ui';
import { hasCoreConsent, recordConsent } from '@/src/consent';
import { useStore } from '@/src/store';
import { space } from '@/src/theme';

/** Asked once of accounts created before consent was recorded — and again if the terms change materially. */
export default function Consent() {
  const consents = useStore((s) => s.consents);
  const signedIn = useStore((s) => !!s.account?.username);
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!signedIn) return <Redirect href="/welcome" />;
  if (hasCoreConsent(consents) && !busy) return <Redirect href="/" />;

  return (
    <Screen contentStyle={{ gap: space(5) }}>
      <Row gap={2}>
        <Heart size={14} />
        <Eyebrow>Your data, your call</Eyebrow>
      </Row>
      <Display>
        A quick <Italic>check-in.</Italic>
      </Display>
      <Body muted>
        rep. now has a Privacy Policy and Terms of Use, and asks clearly before storing health data. Nothing about how your data is used has
        changed — this just puts it in writing.
      </Body>
      <View style={{ gap: space(4) }}>
        <Checkbox checked={terms} onChange={setTerms} label="I agree to the Terms of Use and Privacy Policy, and I’m 16 or older">
          I agree to the <TextLink title="Terms of Use" onPress={() => router.push('/terms')} /> and{' '}
          <TextLink title="Privacy Policy" onPress={() => router.push('/privacy')} />, and I’m 16 or older.
        </Checkbox>
        <Checkbox checked={health} onChange={setHealth} label="I consent to rep. storing my health and fitness data">
          I consent to rep. storing my health and fitness data (workouts, body measurements, steps, and wearable data if I connect it) to
          run the app for me. It’s never sold.
        </Checkbox>
      </View>
      <Button
        title="Continue"
        disabled={!(terms && health)}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await recordConsent('terms_privacy');
          await recordConsent('health_data');
          router.replace('/');
        }}
      />
      <Body muted style={{ fontSize: 13 }}>
        Don’t agree? You can download your data or delete your account instead.{' '}
        <TextLink title="Privacy & your data" onPress={() => router.push('/your-data')} />
      </Body>
    </Screen>
  );
}
