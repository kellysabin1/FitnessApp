import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Chip, Field, Row, Screen } from '@/src/components/ui';
import { createChallenge } from '@/src/social/api';
import { todayKey } from '@/src/store';
import { TEMPLATES } from '@/src/templates';
import { colors, fonts, space } from '@/src/theme';

const LENGTHS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '30 days', days: 30 },
  { label: '6 weeks', days: 42 },
];

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}

export default function NewChallenge() {
  const [name, setName] = useState('');
  const [start, setStart] = useState<'today' | 'tomorrow' | 'monday'>('today');
  const [days, setDays] = useState(14);
  const [scoring, setScoring] = useState({ workouts: true, steps: true, streaks: true, plan: true });
  const [stepGoal, setStepGoal] = useState('8000');
  const [plan, setPlan] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startDate = (() => {
    const d = start === 'monday' ? nextMonday() : new Date();
    if (start === 'tomorrow') d.setDate(d.getDate() + 1);
    return d;
  })();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days - 1);

  const toggle = (k: keyof typeof scoring) => setScoring((s) => ({ ...s, [k]: !s[k] }));
  const togglePlan = (t: string) => setPlan((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const goal = parseInt(stepGoal, 10);
  const valid = name.trim().length > 0 && Object.values(scoring).some(Boolean) && (!scoring.steps || (goal >= 1000 && goal <= 50000));

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const c = await createChallenge({
        name,
        startsOn: todayKey(startDate),
        endsOn: todayKey(endDate),
        scoreWorkouts: scoring.workouts,
        scoreSteps: scoring.steps,
        scoreStreaks: scoring.streaks,
        scorePlan: scoring.plan && plan.length > 0,
        stepGoal: scoring.steps ? goal : 8000,
        plan: plan.map((t) => ({ title: t, exercises: TEMPLATES.find((x) => x.title === t)?.exercises ?? [] })),
      });
      router.replace({ pathname: '/challenge/[id]', params: { id: c.id, fresh: '1' } });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Screen padTop={false} contentStyle={{ gap: space(6), paddingBottom: space(16) }}>
      <Field label="Challenge name" value={name} onChangeText={setName} placeholder="e.g. Glute girls November" autoFocus />

      <Section label="Starts">
        <Chip label="Today" active={start === 'today'} onPress={() => setStart('today')} />
        <Chip label="Tomorrow" active={start === 'tomorrow'} onPress={() => setStart('tomorrow')} />
        <Chip label="Next Monday" active={start === 'monday'} onPress={() => setStart('monday')} />
      </Section>

      <Section label="Length">
        {LENGTHS.map((l) => (
          <Chip key={l.days} label={l.label} active={days === l.days} onPress={() => setDays(l.days)} />
        ))}
      </Section>
      <Body muted style={{ fontSize: 13, marginTop: -space(3) }}>
        {fmt(startDate)} → {fmt(endDate)}
      </Body>

      <Section label="What earns points">
        <Chip label="Workouts" active={scoring.workouts} onPress={() => toggle('workouts')} />
        <Chip label="Daily steps" active={scoring.steps} onPress={() => toggle('steps')} />
        <Chip label="Streaks" active={scoring.streaks} onPress={() => toggle('streaks')} />
        <Chip label="Group plan" active={scoring.plan} onPress={() => toggle('plan')} />
      </Section>
      <Body muted style={{ fontSize: 13, marginTop: -space(3) }}>
        Workout +10 · 1,000 steps +1 (step goal +5) · each streak day +3 · plan workout +5
      </Body>

      {scoring.steps ? (
        <Field label="Daily step goal" value={stepGoal} onChangeText={setStepGoal} keyboardType="number-pad" suffix="steps" />
      ) : null}

      {scoring.plan ? (
        <>
          <Section label="Group plan — everyone does these">
            {TEMPLATES.map((t) => (
              <Chip key={t.title} label={t.title} active={plan.includes(t.title)} onPress={() => togglePlan(t.title)} />
            ))}
          </Section>
          <Body muted style={{ fontSize: 13, marginTop: -space(3) }}>
            {plan.length ? `${plan.length} workout${plan.length > 1 ? 's' : ''} in the plan.` : 'Pick the workouts the whole group will do.'}
          </Body>
        </>
      ) : null}

      <Button title="Create challenge" icon="trophy-outline" loading={busy} disabled={!valid} onPress={create} />
      {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 }}>{label}</Text>
      <Row gap={2} style={{ flexWrap: 'wrap' }}>
        {children}
      </Row>
    </View>
  );
}
