import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Card, Divider, Field, H2, Icon, Row, Screen } from '@/src/components/ui';
import { hasConsent, recordConsent } from '@/src/consent';
import { deleteAccount, downloadExport } from '@/src/social/account-data';
import { useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

/** REP-5 / REP-6: see and control what rep. holds about you. */
export default function YourData() {
  const consents = useStore((s) => s.consents);
  const account = useStore((s) => s.account);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const coachOn = hasConsent('ai_coach', consents);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setMsg(null);
    try {
      const done = await fn();
      if (done) setMsg({ text: done, ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5), paddingBottom: space(16) }}>
      <Body muted>
        rep. keeps your data to run the app for you — never sold, no ads, no trackers. Body measurements are only ever visible to you.
      </Body>

      <Card style={{ gap: space(3) }}>
        <H2 style={{ fontSize: 20 }}>Download my data</H2>
        <Body muted style={{ fontSize: 13 }}>
          Everything in your account plus what’s only on this phone (wearable data, coach chat), as one JSON file.
        </Body>
        <Button
          small
          variant="secondary"
          icon="download-outline"
          title="Download my data"
          loading={busy === 'export'}
          disabled={!account}
          onPress={() => run('export', async () => `Saved ${await downloadExport()}`)}
        />
      </Card>

      <Card style={{ gap: space(3) }}>
        <H2 style={{ fontSize: 20 }}>What you’ve agreed to</H2>
        <Agreement label="Terms of Use & Privacy Policy" on={hasConsent('terms_privacy', consents)} at={consents.terms_privacy?.at} />
        <Agreement label="Storing my health & fitness data" on={hasConsent('health_data', consents)} at={consents.health_data?.at} />
        <Agreement
          label="Sharing challenge-day workouts & steps with challenge members"
          on={hasConsent('challenge_sharing', consents)}
          at={consents.challenge_sharing?.at}
          note="Leave a challenge to stop sharing with it."
        />
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={label}>AI coach (sends data to Anthropic)</Text>
            <Body muted style={{ fontSize: 12 }}>
              {coachOn ? `Allowed ${when(consents.ai_coach?.at)}` : 'Off'}
            </Body>
          </View>
          <Button
            small
            variant={coachOn ? 'ghost' : 'secondary'}
            title={coachOn ? 'Turn off' : 'Review & allow'}
            loading={busy === 'ai'}
            onPress={() =>
              coachOn
                ? run('ai', async () => {
                    await recordConsent('ai_coach', false);
                    return 'AI coach turned off. Nothing more is sent to Anthropic.';
                  })
                : router.push('/coach')
            }
          />
        </Row>
        <Row gap={4} style={{ marginTop: space(1) }}>
          <Button small variant="ghost" title="Privacy Policy" onPress={() => router.push('/privacy')} />
          <Button small variant="ghost" title="Terms of Use" onPress={() => router.push('/terms')} />
        </Row>
        <Row gap={4}>
          <Button small variant="ghost" title="Health Data Policy" onPress={() => router.push('/health-privacy')} />
        </Row>
      </Card>

      {msg ? <Body style={{ fontSize: 14, color: msg.ok ? colors.olive : colors.sand }}>{msg.text}</Body> : null}

      <Card style={{ gap: space(3), borderColor: 'rgba(99,58,56,0.6)' }}>
        <H2 style={{ fontSize: 20 }}>Delete my account</H2>
        <Body muted style={{ fontSize: 13 }}>
          Permanently deletes your account and everything in it: profile, workouts, body log, steps, splits, targets, friends, challenges
          you created (for everyone in them), your feed posts and reminders. You’ll be signed out everywhere. This can’t be undone —
          download your data first if you want a copy.
        </Body>
        {!deleting ? (
          <Button small variant="danger" title="Delete my account…" disabled={!account} onPress={() => setDeleting(true)} />
        ) : (
          <View style={{ gap: space(3) }}>
            <Field
              label="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
            <Field
              label="Type DELETE to confirm"
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              placeholder="DELETE"
            />
            <Button
              variant="danger"
              title="Permanently delete my account"
              loading={busy === 'delete'}
              disabled={!password || confirmText.trim() !== 'DELETE'}
              onPress={() =>
                run('delete', async () => {
                  await deleteAccount(password);
                  router.replace('/welcome');
                })
              }
            />
            <Button small variant="ghost" title="Cancel" onPress={() => setDeleting(false)} />
          </View>
        )}
      </Card>
    </Screen>
  );
}

function Agreement({ label: text, on, at, note }: { label: string; on: boolean; at?: string; note?: string }) {
  return (
    <Row gap={3} style={{ alignItems: 'flex-start' }}>
      <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? colors.olive : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={label}>{text}</Text>
        <Body muted style={{ fontSize: 12 }}>
          {on ? `Agreed ${when(at)}` : 'Not yet'}
          {note ? ` · ${note}` : ''}
        </Body>
      </View>
    </Row>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.cream } as const;
