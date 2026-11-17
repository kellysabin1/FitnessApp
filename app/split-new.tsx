import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { generateSplit } from '@/src/coach';
import { Body, Button, Card, Chip, Eyebrow, Field, H2, Icon, type IconName, Row, Screen } from '@/src/components/ui';
import { byGoals, makeSplitFromStarter, STARTER_SPLITS } from '@/src/splits';
import { uid, useStore } from '@/src/store';
import { colors, fonts, radius, space } from '@/src/theme';
import type { Split } from '@/src/training';

type Mode = 'pick' | 'ai' | 'starter' | 'own';

export default function NewSplit() {
  const goals = useStore((s) => s.profile.goals);
  const defaultDays = useStore((s) => s.profile.daysPerWeek);
  const saveSplit = useStore((s) => s.saveSplit);
  const setActive = useStore((s) => s.setActiveSplit);
  const [mode, setMode] = useState<Mode>('pick');
  const [days, setDays] = useState(Math.min(6, Math.max(2, defaultDays || 4)));
  const [request, setRequest] = useState('');
  const [draft, setDraft] = useState<Split | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');

  const keep = (sp: Split, makeActive: boolean) => {
    saveSplit(sp);
    if (makeActive) setActive(sp.id);
    router.replace({ pathname: '/split/[id]', params: { id: sp.id } });
  };

  const generate = async () => {
    setBusy(true);
    setErr(null);
    setDraft(null);
    try {
      setDraft(await generateSplit(days, request.trim() || undefined));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'pick') {
    return (
      <Screen padTop={false} contentStyle={{ gap: space(3) }}>
        <Body muted>A split is a set of workouts you rotate through in order. Miss a day and the next one simply waits.</Body>
        <Option icon="sparkles-outline" title="Let your coach build it" text="Designed around your goals, experience, equipment and targets." onPress={() => setMode('ai')} />
        <Option icon="albums-outline" title="Start from a ready-made split" text="Proven layouts you can edit afterwards." onPress={() => setMode('starter')} />
        <Option icon="create-outline" title="Build your own" text="Name it and add the workouts you already do each week." onPress={() => setMode('own')} />
      </Screen>
    );
  }

  if (mode === 'own') {
    return (
      <Screen padTop={false} contentStyle={{ gap: space(5) }}>
        <Field label="Split name" value={name} onChangeText={setName} placeholder="e.g. My 5-day split" autoFocus />
        <Body muted style={{ fontSize: 13 }}>Next you’ll add each workout and its exercises.</Body>
        <Button
          title="Create split"
          disabled={!name.trim()}
          onPress={() => {
            const t = new Date().toISOString();
            keep({ id: uid(), name: name.trim(), source: 'custom', workouts: [], createdAt: t, updatedAt: t }, false);
          }}
        />
      </Screen>
    );
  }

  if (mode === 'starter') {
    return (
      <Screen padTop={false} contentStyle={{ gap: space(3) }}>
        {byGoals(STARTER_SPLITS, goals).map((st) => {
          const rec = st.goals.some((g) => goals.includes(g));
          return (
            <Card key={st.name} style={{ gap: space(2) }}>
              {rec ? <Eyebrow color={colors.latte}>Recommended for your goals</Eyebrow> : null}
              <H2 style={{ fontSize: 21 }}>{st.name}</H2>
              <Body muted style={{ fontSize: 13 }}>{st.blurb}</Body>
              <Body muted style={{ fontSize: 12 }}>{st.workouts.map((w) => w.title).join(' → ')}</Body>
              <Button small title="Use this split" onPress={() => keep(makeSplitFromStarter(st), true)} style={{ marginTop: space(1) }} />
            </Card>
          );
        })}
      </Screen>
    );
  }

  // AI
  return (
    <Screen padTop={false} contentStyle={{ gap: space(5), paddingBottom: space(16) }}>
      <View style={{ gap: space(2) }}>
        <Text style={label}>Workouts per week</Text>
        <Row gap={2}>
          {[2, 3, 4, 5, 6].map((d) => (
            <Chip key={d} label={String(d)} active={days === d} onPress={() => setDays(d)} />
          ))}
        </Row>
      </View>
      <Field
        label="Anything specific? (optional)"
        value={request}
        onChangeText={(t) => setRequest(t.slice(0, 500))}
        placeholder="e.g. 45 minutes max, one Pilates day, no barbell squats"
        multiline
      />
      <Button title={draft ? 'Try again' : 'Build my split'} icon="sparkles" loading={busy} onPress={generate} variant={draft ? 'secondary' : 'primary'} />
      {busy ? (
        <Row gap={2}>
          <ActivityIndicator color={colors.latte} />
          <Body muted style={{ fontSize: 13 }}>Designing your split — this can take up to a minute.</Body>
        </Row>
      ) : null}
      {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
      {draft ? (
        <View style={{ gap: space(3) }}>
          <H2>{draft.name}</H2>
          {draft.notes ? <Body muted style={{ fontSize: 14 }}>{draft.notes}</Body> : null}
          {draft.workouts.map((w, i) => (
            <Card key={w.id} style={{ padding: space(4) }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.cream }}>
                {i + 1}. {w.title}
              </Text>
              {w.focus ? <Body muted style={{ fontSize: 13 }}>{w.focus}</Body> : null}
              {w.exercises.map((e, k) => (
                <Text key={k} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                  {e.name} <Text style={{ color: colors.textFaint }}>{e.sets} × {e.reps}</Text>
                </Text>
              ))}
            </Card>
          ))}
          <Button title="Save & make active" icon="checkmark" onPress={() => keep(draft, true)} />
          <Button title="Save without activating" variant="ghost" small onPress={() => keep(draft, false)} />
        </View>
      ) : null}
    </Screen>
  );
}

function Option({ icon, title, text, onPress }: { icon: IconName; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
    >
      <Icon name={icon} size={22} color={colors.latte} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.cream }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{text}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
