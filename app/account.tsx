import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Divider, Eyebrow, Field, H2, Heart, Row, Screen } from '@/src/components/ui';
import { saveProfile, sendPasswordReset, signIn, signOut, signUp, USERNAME_RE } from '@/src/social/api';
import { Checkbox, TextLink } from '@/src/components/Checkbox';
import { recordConsent } from '@/src/consent';
import { useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';

/** Sign up / sign in, then pick a @username. Also the place to sign out. */
export default function AccountScreen() {
  const account = useStore((s) => s.account);
  const profileName = useStore((s) => s.profile.name);

  if (!account) return <SignIn />;
  if (!account.username) return <PickUsername suggested={profileName} />;
  return <SignedIn />;
}

/** Email + password sign up / sign in. `intro` replaces the default explanation (used on the welcome screen). */
export function SignIn({ intro, padTop = false }: { intro?: React.ReactNode; padTop?: boolean }) {
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeHealth, setAgreeHealth] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'up') {
        // explicit, separate consents — saved to the account log once the profile exists
        await recordConsent('terms_privacy');
        await recordConsent('health_data');
        await signUp(email, password);
      } else await signIn(email, password);
    } catch (e) {
      setMsg({ text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMsg({ text: 'Type your email first, then tap “Forgot password”.' });
    try {
      await sendPasswordReset(email);
      setMsg({ text: 'Check your email for a reset link.', ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={padTop} contentStyle={{ gap: space(5) }}>
        {intro ?? (
          <>
            <Row gap={2}>
              <Heart size={16} />
              <Eyebrow>Your account</Eyebrow>
            </Row>
            <Body muted>Your account keeps your workouts, goals and progress safe and lets you train with friends.</Body>
          </>
        )}
        <Row gap={2}>
          <Chip label="Create account" active={mode === 'up'} onPress={() => setMode('up')} />
          <Chip label="Sign in" active={mode === 'in'} onPress={() => setMode('in')} />
        </Row>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'up' ? 'At least 8 characters' : 'Your password'}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
        />
        {mode === 'up' ? (
          <View style={{ gap: space(3) }}>
            <Checkbox
              checked={agreeTerms}
              onChange={setAgreeTerms}
              label="I agree to the Terms of Use and Privacy Policy, and I’m 16 or older"
            >
              I agree to the <TextLink title="Terms of Use" onPress={() => router.push('/terms')} /> and{' '}
              <TextLink title="Privacy Policy" onPress={() => router.push('/privacy')} />, and I’m 16 or older.
            </Checkbox>
            <Checkbox checked={agreeHealth} onChange={setAgreeHealth} label="I consent to rep. storing my health and fitness data">
              I consent to rep. storing my health and fitness data (workouts, body measurements, steps, and wearable data if I connect it)
              to run the app for me, as described in the{' '}
              <TextLink title="Consumer Health Data Privacy Policy" onPress={() => router.push('/health-privacy')} />. It’s never sold.
            </Checkbox>
          </View>
        ) : null}
        <Button
          title={mode === 'up' ? 'Create account' : 'Sign in'}
          loading={busy}
          disabled={!email.includes('@') || password.length < (mode === 'up' ? 8 : 1) || (mode === 'up' && !(agreeTerms && agreeHealth))}
          onPress={submit}
        />
        {mode === 'in' ? <Button title="Forgot password?" variant="ghost" small onPress={reset} /> : null}
        {msg ? <Body style={{ fontSize: 14, color: msg.ok ? colors.latte : colors.sand }}>{msg.text}</Body> : null}
        <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 20, color: colors.textMuted, marginTop: space(4) }}>
          <TextLink title="Privacy Policy" onPress={() => router.push('/privacy')} />
          {'  ·  '}
          <TextLink title="Consumer Health Data Privacy Policy" onPress={() => router.push('/health-privacy')} />
          {'  ·  '}
          <TextLink title="Terms of Use" onPress={() => router.push('/terms')} />
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Pick @username + display name. `onDone` defaults to closing the screen. */
export function PickUsername({ suggested, onDone, padTop = false }: { suggested: string; onDone?: () => void; padTop?: boolean }) {
  const [username, setUsername] = useState(
    suggested
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20),
  );
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = username.trim().toLowerCase().replace(/^@/, '');

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await saveProfile(clean, name);
      if (onDone) onDone();
      else router.back();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padTop={padTop} contentStyle={{ gap: space(5) }}>
      <Eyebrow>One last thing</Eyebrow>
      <H2>Pick your @username</H2>
      <Body muted>Friends find you by this. Lowercase letters, numbers and _ only.</Body>
      <Field label="Username" value={username} onChangeText={setUsername} placeholder="kelly" autoCapitalize="none" autoCorrect={false} />
      <Field label="Display name" value={name} onChangeText={setName} placeholder="Kelly" />
      {clean && !USERNAME_RE.test(clean) ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.sand }}>3–20 characters: a–z, 0–9 and _</Text>
      ) : null}
      <Button title="Save" loading={busy} disabled={!USERNAME_RE.test(clean) || !name.trim()} onPress={save} />
      {err ? <Body style={{ fontSize: 14, color: colors.sand }}>{err}</Body> : null}
    </Screen>
  );
}

function SignedIn() {
  const account = useStore((s) => s.account)!;
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const [editing, setEditing] = useState(false);

  if (editing) return <PickUsername suggested={account.displayName ?? ''} />;

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5) }}>
      <Card style={{ gap: space(2) }}>
        <Eyebrow>Signed in</Eyebrow>
        <H2>@{account.username}</H2>
        <Body muted>{account.displayName}</Body>
        <Body muted style={{ fontSize: 13 }}>
          {account.email}
        </Body>
        <Divider />
        <Body muted style={{ fontSize: 13 }}>
          {lastSyncAt ? `Backed up ${new Date(lastSyncAt).toLocaleString()}` : 'Backing up…'}
        </Body>
      </Card>
      <Button title="Edit username" variant="secondary" onPress={() => setEditing(true)} />
      <Body muted style={{ fontSize: 13 }}>
        Signing out removes your data from this phone. It’s saved in your account and comes back when you sign in.
      </Body>
      <Button title="Sign out" variant="danger" onPress={() => confirmSignOut()} />
      <Button title="Privacy & your data" variant="ghost" small icon="shield-checkmark-outline" onPress={() => router.push('/your-data')} />
      <View style={{ height: space(4) }} />
    </Screen>
  );
}

async function confirmSignOut() {
  const ask = (title: string, msg: string) =>
    new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(confirm(`${title}\n\n${msg}`));
      } else {
        Alert.alert(title, msg, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
        ]);
      }
    });
  if (!(await ask('Sign out?', 'Your data stays in your account and comes back when you sign in.'))) return;
  if (!(await signOut())) {
    const force = await ask(
      'Couldn’t back up',
      'You seem to be offline, so your latest changes aren’t saved to your account yet. Sign out anyway and lose them?',
    );
    if (!force) return;
    await signOut(true);
  }
  router.replace('/welcome');
}
