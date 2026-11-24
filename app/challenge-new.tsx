import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Chip, Field, Icon, IconName, Row, Screen } from '@/src/components/ui';
import { type ChallengeMode, createChallenge, type PlanItem, TASK_EXAMPLES, TASK_POINTS } from '@/src/social/api';
import { PlanBuilder } from '@/src/social/PlanBuilder';
import { todayKey } from '@/src/store';
import { colors, fonts, radius, space } from '@/src/theme';

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
  const [mode, setMode] = useState<ChallengeMode>('any');
  const [start, setStart] = useState<'today' | 'tomorrow' | 'monday'>('today');
  const [days, setDays] = useState(14);
  const [customDays, setCustomDays] = useState<string | null>(null); // non-null = custom length
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskText, setTaskText] = useState('');
  const [scoring, setScoring] = useState({ workouts: true, steps: true, streaks: true, plan: true });
  const [stepGoal, setStepGoal] = useState('8000');
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startDate = (() => {
    const d = start === 'monday' ? nextMonday() : new Date();
    if (start === 'tomorrow') d.setDate(d.getDate() + 1);
    return d;
  })();
  const length = customDays !== null ? parseInt(customDays, 10) : days;
  const lengthOk = Number.isInteger(length) && length >= 1 && length <= 120;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (lengthOk ? length : 1) - 1);

  const toggle = (k: keyof typeof scoring) => setScoring((s) => ({ ...s, [k]: !s[k] }));
  const goal = parseInt(stepGoal, 10);
  const planOnly = mode === 'plan';
  const problem = !name.trim()
    ? 'Give your challenge a name.'
    : !lengthOk
      ? 'Length should be between 1 and 120 days.'
      : planOnly && plan.length === 0
        ? 'Add at least one workout to the plan.'
        : !(scoring.workouts || scoring.steps || scoring.streaks)
          ? 'Pick at least one way to earn points.'
          : scoring.steps && !(goal >= 1000 && goal <= 50000)
            ? 'Step goal should be between 1,000 and 50,000.'
            : null;

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const c = await createChallenge({
        name,
        mode,
        startsOn: todayKey(startDate),
        endsOn: todayKey(endDate),
        scoreWorkouts: scoring.workouts,
        scoreSteps: scoring.steps,
        scoreStreaks: scoring.streaks,
        scorePlan: !planOnly && scoring.plan && plan.length > 0,
        stepGoal: scoring.steps ? goal : 8000,
        plan,
        description,
        tasks,
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
      <Field label="Challenge name" value={name} onChangeText={setName} placeholder="e.g. November lift club" />

      <Field
        label="Goal or house rules (optional)"
        value={description}
        onChangeText={(t) => setDescription(t.slice(0, 500))}
        placeholder="e.g. 4 workouts a week, 10k steps a day. Loser buys coffee."
        multiline
      />

      <View style={{ gap: space(2) }}>
        <Text style={label}>What kind of challenge?</Text>
        <ModeCard
          icon="flash-outline"
          title="Any workout"
          text="Every workout anyone logs counts. You can still add a shared plan for bonus points."
          active={mode === 'any'}
          onPress={() => setMode('any')}
        />
        <ModeCard
          icon="list-outline"
          title="Group plan"
          text="Everyone follows the same plan. Only the plan’s workouts count."
          active={mode === 'plan'}
          onPress={() => setMode('plan')}
        />
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={label}>{planOnly ? 'The plan — only these workouts count' : 'Shared plan (optional, +5 bonus each)'}</Text>
        <PlanBuilder value={plan} onChange={setPlan} />
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={label}>Add daily tasks? (optional, up to 3)</Text>
        <Body muted style={{ fontSize: 13 }}>
          Small habits everyone ticks off each day — +{TASK_POINTS} points each.
        </Body>
        {tasks.map((t) => (
          <Row key={t} style={{ justifyContent: 'space-between', paddingVertical: space(1) }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream, flex: 1 }}>• {t}</Text>
            <Pressable onPress={() => setTasks((x) => x.filter((y) => y !== t))} hitSlop={8} accessibilityLabel={`Remove ${t}`}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </Row>
        ))}
        {tasks.length < 3 ? (
          <>
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {TASK_EXAMPLES.filter((e) => !tasks.includes(e)).map((e) => (
                <Chip key={e} icon="add" label={e} onPress={() => setTasks((x) => (x.length < 3 ? [...x, e] : x))} />
              ))}
            </Row>
            <Row gap={2}>
              <Field style={{ flex: 1 }} value={taskText} onChangeText={(t) => setTaskText(t.slice(0, 60))} placeholder="Write your own" />
              <Button
                small
                title="Add"
                disabled={!taskText.trim() || tasks.some((t) => t.toLowerCase() === taskText.trim().toLowerCase())}
                onPress={() => {
                  setTasks((x) => (x.length < 3 ? [...x, taskText.trim()] : x));
                  setTaskText('');
                }}
              />
            </Row>
          </>
        ) : (
          <Body muted style={{ fontSize: 12 }}>
            That’s the max of 3 — remove one to swap it.
          </Body>
        )}
      </View>

      <Section label="Starts">
        <Chip label="Today" active={start === 'today'} onPress={() => setStart('today')} />
        <Chip label="Tomorrow" active={start === 'tomorrow'} onPress={() => setStart('tomorrow')} />
        <Chip label="Next Monday" active={start === 'monday'} onPress={() => setStart('monday')} />
      </Section>

      <Section label="Length">
        {LENGTHS.map((l) => (
          <Chip
            key={l.days}
            label={l.label}
            active={customDays === null && days === l.days}
            onPress={() => {
              setDays(l.days);
              setCustomDays(null);
            }}
          />
        ))}
        <Chip label="Custom" active={customDays !== null} onPress={() => setCustomDays(customDays ?? String(days))} />
      </Section>
      {customDays !== null ? (
        <Field label="How many days?" value={customDays} onChangeText={setCustomDays} keyboardType="number-pad" suffix="days" />
      ) : null}
      <Body muted style={{ fontSize: 13, marginTop: -space(3) }}>
        {fmt(startDate)} → {fmt(endDate)}
      </Body>

      <Section label="What earns points">
        <Chip label={planOnly ? 'Plan workouts' : 'Workouts'} active={scoring.workouts} onPress={() => toggle('workouts')} />
        <Chip label="Daily steps" active={scoring.steps} onPress={() => toggle('steps')} />
        <Chip label="Streaks" active={scoring.streaks} onPress={() => toggle('streaks')} />
        {!planOnly && plan.length ? <Chip label="Plan bonus" active={scoring.plan} onPress={() => toggle('plan')} /> : null}
      </Section>
      <Body muted style={{ fontSize: 13, marginTop: -space(3) }}>
        {planOnly ? 'Plan workout +10' : 'Workout +10'} · 1,000 steps +1 (step goal +5) · each streak day +3
        {!planOnly && plan.length && scoring.plan ? ' · plan workout +5 bonus' : ''}
      </Body>

      {scoring.steps ? (
        <Field label="Daily step goal" value={stepGoal} onChangeText={setStepGoal} keyboardType="number-pad" suffix="steps" />
      ) : null}

      <Body muted style={{ fontSize: 13 }}>
        Members will see your workouts (exercises, sets, weights, reps) and daily steps from the challenge dates only — never your body
        measurements. Leave any time.
      </Body>
      <Button title="Create challenge" icon="trophy-outline" loading={busy} disabled={!!problem} onPress={create} />
      {problem && name.trim() ? <Body style={{ color: colors.sand, fontSize: 13, marginTop: -space(3) }}>{problem}</Body> : null}
      {err ? <Body style={{ color: colors.sand, fontSize: 14 }}>{err}</Body> : null}
    </Screen>
  );
}

function ModeCard({
  icon,
  title,
  text,
  active,
  onPress,
}: {
  icon: IconName;
  title: string;
  text: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: space(3),
        padding: space(4),
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: active ? 'rgba(216,193,166,0.45)' : colors.line,
        backgroundColor: active ? colors.burgundy : colors.card,
      }}
    >
      <Icon name={icon} size={20} color={active ? colors.cream : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.cream }}>{title}</Text>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: active ? colors.text : colors.textMuted, marginTop: 2 }}
        >
          {text}
        </Text>
      </View>
      <Icon name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.cream : colors.textFaint} />
    </Pressable>
  );
}

function Section({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      <Text style={label}>{text}</Text>
      <Row gap={2} style={{ flexWrap: 'wrap' }}>
        {children}
      </Row>
    </View>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
