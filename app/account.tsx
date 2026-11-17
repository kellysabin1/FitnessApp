import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Divider, Eyebrow, Field, H2, Heart, Row, Screen } from '@/src/components/ui';
import { saveProfile, sendPasswordReset, signIn, signOut, signUp, USERNAME_RE } from '@/src/social/api';
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

function SignIn() {
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'up') await signUp(email, password);
      else await signIn(email, password);
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
      <Screen padTop={false} contentStyle={{ gap: space(5) }}>
        <Row gap={2}>
          <Heart size={16} />
          <Eyebrow>Train together</Eyebrow>
        </Row>
        <Body muted>
          An account lets you add friends, start challenges and back up your workouts. Your workouts stay on this phone too.
        </Body>
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
          placeholder={mode === 'up' ? 'At least 6 characters' : 'Your password'}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
        />
        <Button
          title={mode === 'up' ? 'Create account' : 'Sign in'}
          loading={busy}
          disabled={!email.includes('@') || password.length < 6}
          onPress={submit}
        />
        {mode === 'in' ? <Button title="Forgot password?" variant="ghost" small onPress={reset} /> : null}
        {msg ? <Body style={{ fontSize: 14, color: msg.ok ? colors.latte : colors.sand }}>{msg.text}</Body> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function PickUsername({ suggested }: { suggested: string }) {
  const [username, setUsername] = useState(suggested.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20));
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = username.trim().toLowerCase().replace(/^@/, '');

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await saveProfile(clean, name);
      router.back();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(5) }}>
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
        <Body muted style={{ fontSize: 13 }}>{account.email}</Body>
        <Divider />
        <Body muted style={{ fontSize: 13 }}>
          {lastSyncAt ? `Backed up ${new Date(lastSyncAt).toLocaleString()}` : 'Backing up your workouts…'}
        </Body>
      </Card>
      <Button title="Edit username" variant="secondary" onPress={() => setEditing(true)} />
      <Button
        title="Sign out"
        variant="danger"
        onPress={async () => {
          await signOut();
          router.back();
        }}
      />
      <View style={{ height: space(4) }} />
    </Screen>
  );
}
