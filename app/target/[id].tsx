import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { generateTargetPlan } from '@/src/coach';
import { LineChart } from '@/src/components/charts';
import { ProgressBar, StatusPill } from '@/src/components/TargetCard';
import { Body, Button, Card, Divider, Eyebrow, Field, Icon, Row, Screen, SectionHeader, Stat } from '@/src/components/ui';
import { startPlannedWorkout } from '@/src/splits';
import { todayKey, uid, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import {
  describeTarget,
  fmtTargetValue,
  fmtTime,
  parseTargetInput,
  TARGET_KIND_LABEL,
  targetSeries,
  targetStatus,
  targetUnit,
} from '@/src/training';

const fmtDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function TargetScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const t = useStore((s) => s.targets.find((x) => x.id === id));
  const units = useStore((s) => s.units);
  const workouts = useStore((s) => s.workouts);
  const body = useStore((s) => s.body);
  const health = useStore((s) => s.health);
  const saveTarget = useStore((s) => s.saveTarget);
  const deleteTarget = useStore((s) => s.deleteTarget);
  const saveSplit = useStore((s) => s.saveSplit);
  const updateProfile = useStore((s) => s.updateProfile);
  const stepGoal = useStore((s) => s.profile.stepGoal);
  const { width } = useWindowDimensions();
  const [checkin, setCheckin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedSplit, setSavedSplit] = useState(false);

  if (!t) {
    return (
      <Screen padTop={false}>
        <Body muted>This target no longer exists.</Body>
      </Screen>
    );
  }

  const ctx = { workouts, body, health };
  const st = targetStatus(t, ctx);
  const unit = targetUnit(t, units);
  const fmt = (v?: number) => `${fmtTargetValue(t, v, units)}${unit && v != null ? ` ${unit}` : ''}`;
  const series = targetSeries(t, ctx).map((p) => ({
    label: fmtDate(p.date),
    value: t.kind === 'run' ? p.value / 60 : +fmtTargetValue(t, p.value, units).replace(/,/g, ''),
  }));
  const runChart = t.kind === 'run';
  const goalLine = runChart ? t.targetValue / 60 : +fmtTargetValue(t, t.targetValue, units).replace(/,/g, '');
  // check-ins are the main signal for runs/custom; for others they can fill gaps (e.g. a lift done elsewhere)
  const needsCheckins = t.kind === 'run' || t.kind === 'custom';
  const checkinVal = parseTargetInput(t, checkin, units);

  const confirm = (title: string, msg: string, action: string, go: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) go();
    } else
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: 'destructive', onPress: go },
      ]);
  };

  const addCheckin = () => {
    if (checkinVal == null) return;
    const date = todayKey();
    saveTarget({
      ...t,
      checkins: [...t.checkins.filter((c) => c.date !== date), { date, value: checkinVal }].sort((a, b) => a.date.localeCompare(b.date)),
    });
    setCheckin('');
  };

  const plan = async () => {
    setBusy(true);
    setErr(null);
    try {
      const p = await generateTargetPlan(t);
      saveTarget({ ...useStore.getState().targets.find((x) => x.id === t.id)!, plan: p });
      setSavedSplit(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const savePlanAsSplit = () => {
    if (!t.plan?.workouts.length) return;
    const now = new Date().toISOString();
    saveSplit({
      id: uid(),
      name: `For: ${t.title}`,
      notes: t.plan.summary,
      source: 'coach',
      workouts: t.plan.workouts.map((w) => ({ ...w, id: uid() })),
      createdAt: now,
      updatedAt: now,
    });
    setSavedSplit(true);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row gap={5}>
              <Pressable
                hitSlop={12}
                accessibilityLabel="Edit target"
                onPress={() => router.push({ pathname: '/target-new', params: { id: t.id } })}
              >
                <Icon name="create-outline" color={colors.textMuted} />
              </Pressable>
              <Pressable
                hitSlop={12}
                accessibilityLabel="Delete target"
                onPress={() =>
                  confirm('Delete this target?', `“${t.title}” and its check-ins will be removed.`, 'Delete', () => {
                    deleteTarget(t.id);
                    router.back();
                  })
                }
              >
                <Icon name="trash-outline" color={colors.textMuted} />
              </Pressable>
            </Row>
          ),
        }}
      />
      <Screen padTop={false}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>{TARGET_KIND_LABEL[t.kind]}</Eyebrow>
          <StatusPill t={t} />
        </Row>
        <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.cream, marginTop: space(1) }}>{t.title}</Text>
        <Body muted style={{ fontSize: 14 }}>
          {describeTarget(t, units)}
        </Body>

        <Card tone="croc" style={{ marginTop: space(5) }}>
          <Row gap={4}>
            {t.kind === 'steps' || t.kind === 'workouts' ? null : (
              <Stat label="Start" value={fmtTargetValue(t, t.startValue, units)} unit={unit} />
            )}
            <Stat
              label={t.kind === 'steps' ? '7-day avg' : t.kind === 'workouts' ? 'This week' : 'Now'}
              value={fmtTargetValue(t, st.current, units)}
              unit={st.current != null ? unit : undefined}
            />
            <Stat label="Target" value={fmtTargetValue(t, t.targetValue, units)} unit={unit} />
          </Row>
          <ProgressBar progress={st.progress} expected={t.status === 'active' ? st.expected : undefined} />
          <Row style={{ justifyContent: 'space-between', marginTop: space(2) }}>
            <Text style={small}>{Math.round(st.progress * 100)}% of the way</Text>
            <Text style={small}>
              {t.status === 'active'
                ? `${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left · by ${fmtDate(t.endDate)}`
                : t.status === 'done'
                  ? 'Completed'
                  : 'Archived'}
            </Text>
          </Row>
          {t.status === 'active' && st.current != null && !st.reached && st.expected > 0 && st.expected < 1 ? (
            <Text style={[small, { marginTop: space(2) }]}>
              The tick marks where you’d be on a steady pace.{' '}
              {st.onTrack ? 'You’re keeping up.' : 'You’re a little behind — the plan below can help.'}
            </Text>
          ) : null}
        </Card>

        {fresh ? (
          <Card tone="satin" style={{ marginTop: space(3) }}>
            <Body style={{ fontSize: 14 }}>Target set. Want your coach to map out how to get there?</Body>
          </Card>
        ) : null}

        {t.status === 'active' && st.reached ? (
          <Card style={{ marginTop: space(3), gap: space(2) }}>
            <Row gap={2}>
              <Icon name="trophy-outline" color={colors.brass} />
              <Text style={{ fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 15 }}>You hit it.</Text>
            </Row>
            <Button
              small
              title="Mark as done"
              icon="checkmark"
              onPress={() => saveTarget({ ...t, status: 'done', completedAt: new Date().toISOString() })}
            />
          </Card>
        ) : null}

        {series.length >= 2 ? (
          <>
            <SectionHeader title="Trend" />
            <Card>
              <LineChart data={series} width={width - space(20)} goal={goalLine} formatY={runChart ? (n) => fmtTime(n * 60) : undefined} />
            </Card>
          </>
        ) : null}

        {t.status === 'active' ? (
          <>
            <SectionHeader title="Check in" />
            <Card style={{ gap: space(3) }}>
              <Body muted style={{ fontSize: 13 }}>
                {needsCheckins
                  ? t.kind === 'run'
                    ? `Log your latest ${t.runDistance ?? ''} time.`
                    : 'Log where you are today.'
                  : t.kind === 'bodyweight' || t.kind === 'measurement'
                    ? 'This updates from your body log. You can also check in here.'
                    : t.kind === 'lift'
                      ? `This updates from logged ${t.exercise} sets. Check in here for a lift you did elsewhere.`
                      : 'This updates automatically. Check in to override today.'}
              </Body>
              <Row>
                <Field
                  style={{ flex: 1 }}
                  label="Today"
                  value={checkin}
                  onChangeText={setCheckin}
                  placeholder={t.kind === 'run' ? '6:45' : '—'}
                  keyboardType={t.kind === 'run' ? 'numbers-and-punctuation' : 'decimal-pad'}
                  suffix={t.kind === 'run' ? 'min:sec' : unit}
                />
              </Row>
              <Button small title="Save check-in" disabled={checkinVal == null} onPress={addCheckin} />
              {t.checkins.length ? (
                <View style={{ gap: space(1) }}>
                  {[...t.checkins]
                    .reverse()
                    .slice(0, 6)
                    .map((c) => (
                      <Row key={c.date} style={{ justifyContent: 'space-between' }}>
                        <Text style={small}>{fmtDate(c.date)}</Text>
                        <Row gap={3}>
                          <Text style={[small, { color: colors.cream }]}>{fmt(c.value)}</Text>
                          <Pressable
                            hitSlop={8}
                            accessibilityLabel={`Remove check-in ${c.date}`}
                            onPress={() => saveTarget({ ...t, checkins: t.checkins.filter((x) => x.date !== c.date) })}
                          >
                            <Icon name="close" size={14} color={colors.textFaint} />
                          </Pressable>
                        </Row>
                      </Row>
                    ))}
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        <SectionHeader title="Your plan" />
        {t.plan ? (
          <Card tone="stripe" style={{ gap: space(3) }}>
            <Row gap={2}>
              <Icon name="sparkles" size={16} color={colors.latte} />
              <Eyebrow color={colors.latte}>From your coach · {fmtDate(t.plan.generatedAt.slice(0, 10))}</Eyebrow>
            </Row>
            <Body style={{ fontSize: 15 }}>{t.plan.summary}</Body>
            {t.plan.weekly.length ? (
              <View style={{ gap: space(1) }}>
                <Text style={label}>Each week</Text>
                {t.plan.weekly.map((x, i) => (
                  <Body key={i} muted style={{ fontSize: 14 }}>
                    · {x}
                  </Body>
                ))}
              </View>
            ) : null}
            {t.plan.actions.length ? (
              <View style={{ gap: space(1) }}>
                <Text style={label}>This week, do this</Text>
                {t.plan.actions.map((x, i) => (
                  <Body key={i} muted style={{ fontSize: 14 }}>
                    · {x}
                  </Body>
                ))}
              </View>
            ) : null}
            {t.plan.stepGoal ? (
              <Row style={{ justifyContent: 'space-between' }}>
                <Body muted style={{ fontSize: 14, flex: 1 }}>
                  Step goal: {t.plan.stepGoal.toLocaleString()} / day
                </Body>
                {stepGoal === t.plan.stepGoal ? (
                  <Text style={[small, { color: colors.olive }]}>In use ✓</Text>
                ) : (
                  <Button small variant="secondary" title="Use this" onPress={() => updateProfile({ stepGoal: t.plan!.stepGoal! })} />
                )}
              </Row>
            ) : null}
          </Card>
        ) : (
          <Card style={{ gap: space(2) }}>
            <Body muted style={{ fontSize: 14 }}>
              Your coach can turn this into a weekly plan — what to do each week, the workouts to run, and a step goal if it helps.
            </Body>
          </Card>
        )}

        {t.plan?.workouts.length ? (
          <View style={{ gap: space(3), marginTop: space(3) }}>
            {t.plan.workouts.map((w) => (
              <Card key={w.id} style={{ padding: space(4) }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.cream }}>{w.title}</Text>
                {w.focus ? (
                  <Body muted style={{ fontSize: 13 }}>
                    {w.focus}
                  </Body>
                ) : null}
                {w.exercises.map((e, k) => (
                  <Text key={k} style={[small, { marginTop: 2 }]}>
                    {e.name}
                    {e.sets ? <Text style={{ color: colors.textFaint }}>{`  ${e.sets} × ${e.reps ?? ''}`}</Text> : null}
                  </Text>
                ))}
                <Button
                  small
                  title="Start"
                  icon="play"
                  style={{ marginTop: space(3) }}
                  onPress={() => router.push(`/workout/${startPlannedWorkout(w.title, w.exercises)}`)}
                />
              </Card>
            ))}
            <Button
              small
              variant="secondary"
              icon={savedSplit ? 'checkmark' : 'albums-outline'}
              title={savedSplit ? 'Saved to your splits' : 'Save these workouts as a split'}
              disabled={savedSplit}
              onPress={savePlanAsSplit}
            />
          </View>
        ) : null}

        {t.status === 'active' ? (
          <>
            <Button
              title={t.plan ? 'Rebuild my plan' : 'Build my plan'}
              icon="sparkles"
              variant={t.plan ? 'ghost' : 'primary'}
              loading={busy}
              style={{ marginTop: space(4) }}
              onPress={plan}
            />
            {busy ? (
              <Row gap={2} style={{ marginTop: space(2) }}>
                <ActivityIndicator color={colors.latte} />
                <Body muted style={{ fontSize: 13 }}>
                  Building your plan — this can take up to a minute.
                </Body>
              </Row>
            ) : null}
            {err ? <Body style={{ color: colors.sand, fontSize: 14, marginTop: space(2) }}>{err}</Body> : null}
          </>
        ) : null}

        {t.history.length ? (
          <>
            <SectionHeader title="Changes" />
            <Card style={{ gap: space(1) }}>
              {[...t.history].reverse().map((h, i) => (
                <Text key={i} style={small}>
                  {fmtDate(h.at.slice(0, 10))}: was {fmt(h.targetValue)} by {fmtDate(h.endDate)}
                </Text>
              ))}
            </Card>
          </>
        ) : null}

        <Divider />
        {t.status === 'active' ? (
          <Row gap={2}>
            <Button
              small
              variant="secondary"
              title="Mark done"
              style={{ flex: 1 }}
              onPress={() => saveTarget({ ...t, status: 'done', completedAt: new Date().toISOString() })}
            />
            <Button small variant="ghost" title="Archive" style={{ flex: 1 }} onPress={() => saveTarget({ ...t, status: 'archived' })} />
          </Row>
        ) : (
          <Button
            small
            variant="secondary"
            title="Make active again"
            onPress={() => saveTarget({ ...t, status: 'active', completedAt: undefined })}
          />
        )}
        <View style={{ height: space(10) }} />
      </Screen>
    </>
  );
}

const small = { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted } as const;
const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
