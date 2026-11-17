import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bars, Ring } from '@/src/components/charts';
import { Body, Button, Card, Display, Eyebrow, H2, Heart, Icon, Italic, Row, SectionHeader, Stat } from '@/src/components/ui';
import { syncHealth } from '@/src/health/sync';
import { TodayTasks } from '@/src/social/TodayTasks';
import { UpNextCard } from '@/src/components/UpNext';
import { lastNDates, relativeDay, setsDone, weekStreak, workoutDurationMin, workoutsThisWeek, latestBody } from '@/src/stats';
import { healthForDate, todayKey, useStore } from '@/src/store';
import { colors, fonts, gradients, space } from '@/src/theme';
import { displayWeight, weightLabel } from '@/src/units';

export default function Today() {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const today = healthForDate(s.health, todayKey());
  const active = s.workouts.find((w) => !w.finishedAt);
  const lastDone = s.workouts.find((w) => w.finishedAt);
  const weekCount = workoutsThisWeek(s.workouts);
  const streak = weekStreak(s.workouts);
  const weight = latestBody(s.body, 'weightKg');
  const connected = s.appleHealthEnabled || !!s.oura;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await syncHealth(14);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (connected) syncHealth(7);
  }, [connected]);

  const stepGoal = s.plan?.stepGoal ?? s.profile.stepGoal;
  const steps = today.steps ?? 0;
  const week = lastNDates(7).map((d) => ({
    label: new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' }),
    value: healthForDate(s.health, d).steps ?? 0,
  }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const chartW = width - space(10) - space(10);

  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space(4), paddingHorizontal: space(5), paddingBottom: insets.bottom + space(28) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.latte} />}
        showsVerticalScrollIndicator={false}
      >
        <Row gap={2}>
          <Heart size={14} />
          <Eyebrow>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Eyebrow>
        </Row>
        <Display style={{ marginTop: space(2) }}>
          {s.profile.name ? (
            <>
              {greeting},{'\n'}
              <Italic>{s.profile.name}.</Italic>
            </>
          ) : (
            <>
              {greeting.split(' ')[0]} <Italic>{greeting.split(' ')[1]}.</Italic>
            </>
          )}
        </Display>

        {/* Hero: steps ring + readiness */}
        <Card tone="croc" style={{ marginTop: space(6) }}>
          <Row gap={5}>
            <Ring size={128} stroke={11} progress={steps / stepGoal} color={colors.latte} track="rgba(255,255,255,0.1)">
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.cream }}>{steps ? steps.toLocaleString() : '—'}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textMuted }}>of {stepGoal.toLocaleString()}</Text>
            </Ring>
            <View style={{ flex: 1, gap: space(3) }}>
              <Eyebrow color={colors.sand}>Today</Eyebrow>
              <Row gap={4}>
                <Stat label="Sleep" value={today.sleepHours != null ? String(today.sleepHours) : '—'} unit="h" />
                <Stat label="Readiness" value={today.readiness != null ? String(today.readiness) : '—'} />
              </Row>
              <Row gap={4}>
                <Stat label="Resting HR" value={today.restingHr != null ? String(today.restingHr) : '—'} />
                <Stat label="HRV" value={today.hrvMs != null ? String(today.hrvMs) : '—'} unit="ms" />
              </Row>
            </View>
          </Row>
          {!connected ? (
            <Row gap={2} style={{ marginTop: space(5) }}>
              <Button small variant="secondary" icon="footsteps-outline" title="Log steps" style={{ flex: 1 }} onPress={() => router.push('/log-steps')} />
              <Button small variant="ghost" icon="link-outline" title="Connect" onPress={() => router.push('/you')} />
            </Row>
          ) : null}
        </Card>

        {/* Workout CTA */}
        <SectionHeader title="Train" action="History" onAction={() => router.push('/train')} />
        {!active ? <UpNextCard style={{ marginBottom: space(3) }} /> : null}
        {active ? (
          <Card tone="tortoise" onPress={() => router.push(`/workout/${active.id}`)}>
            <Eyebrow color={colors.latte}>In progress</Eyebrow>
            <H2 style={{ marginTop: space(1) }}>{active.title}</H2>
            <Body muted>
              {active.exercises.length} exercises · {setsDone(active)} sets done · tap to continue
            </Body>
          </Card>
        ) : (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <H2>Ready when you are</H2>
                <Body muted>
                  {weekCount} of {s.profile.daysPerWeek} sessions this week
                  {streak > 1 ? ` · ${streak}-week streak` : ''}
                </Body>
              </View>
              <Ring size={54} stroke={5} progress={weekCount / s.profile.daysPerWeek} color={colors.sand}>
                <Text style={{ fontFamily: fonts.bodyBold, color: colors.cream, fontSize: 13 }}>{weekCount}</Text>
              </Ring>
            </Row>
            <Button
              title="Start a workout"
              icon="add"
              style={{ marginTop: space(4) }}
              onPress={() => router.push(`/workout/${s.startWorkout()}`)}
            />
            <Button title="Log one I already did" variant="ghost" small style={{ marginTop: space(2) }} onPress={() => router.push('/log-past')} />
          </Card>
        )}

        <TodayTasks />

        {/* Coach focus */}
        <SectionHeader title="Coach’s note" action={s.plan ? 'Open' : undefined} onAction={() => router.push('/coach')} />
        <Card tone="stripe" onPress={() => router.push('/coach')}>
          <Row gap={2}>
            <Icon name="sparkles" size={16} color={colors.latte} />
            <Eyebrow color={colors.latte}>Your AI trainer</Eyebrow>
          </Row>
          {s.plan ? (
            <>
              <H2 style={{ marginTop: space(2) }}>{s.plan.headline}</H2>
              <Body muted style={{ marginTop: space(1) }}>{s.plan.focus}</Body>
            </>
          ) : (
            <>
              <H2 style={{ marginTop: space(2) }}>Get your personalized plan</H2>
              <Body muted style={{ marginTop: space(1) }}>
                Exercise ideas, a step target and recovery tips built from your goals and your data.
              </Body>
            </>
          )}
        </Card>

        {/* Steps week */}
        <SectionHeader title="Steps this week" />
        <Card>
          <Bars data={week} width={chartW} goal={stepGoal} />
        </Card>

        {/* Snapshot */}
        <SectionHeader title="Snapshot" action="Log body" onAction={() => router.push('/log-body')} />
        <Row gap={3}>
          <Card style={{ flex: 1 }}>
            <Stat label="Weight" value={weight ? displayWeight(weight.weightKg, s.units) : '—'} unit={weightLabel(s.units)} icon="scale-outline" />
          </Card>
          <Card style={{ flex: 1 }}>
            {lastDone ? (
              <Stat label={`Last · ${relativeDay(lastDone.startedAt)}`} value={String(workoutDurationMin(lastDone))} unit="min" icon="time-outline" />
            ) : (
              <Stat label="Last workout" value="—" icon="time-outline" />
            )}
          </Card>
        </Row>
      </ScrollView>
    </LinearGradient>
  );
}
