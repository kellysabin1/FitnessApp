import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Bars, LineChart } from '@/src/components/charts';
import { Body, Button, Card, Chip, Display, Empty, Eyebrow, Icon, Italic, Row, Screen, SectionHeader, Stat } from '@/src/components/ui';
import { TargetCard } from '@/src/components/TargetCard';
import { finished, lastNDates, latestBody, weightSeries } from '@/src/stats';
import { GOAL_LABEL, healthForDate, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import { displayWeight, kgToLb, weightLabel } from '@/src/units';

const RANGES = [30, 90, 365] as const;

export default function Progress() {
  const s = useStore();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<(typeof RANGES)[number]>(90);
  const u = s.units;
  const wl = weightLabel(u);
  const chartW = width - space(20);

  const series = weightSeries(s.body, range).map((p) => ({
    label: new Date(p.date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: u === 'us' ? kgToLb(p.value) : p.value,
  }));
  const goal = s.profile.goalWeightKg != null ? (u === 'us' ? kgToLb(s.profile.goalWeightKg) : s.profile.goalWeightKg) : undefined;
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  const change = first != null && last != null ? last - first : undefined;
  const toGo = goal != null && last != null ? last - goal : undefined;

  const dates = lastNDates(14);
  const sleep = dates.map((d) => ({ label: d.slice(8), value: healthForDate(s.health, d).sleepHours ?? 0 }));
  const hrv = dates
    .map((d) => ({ label: d.slice(5), value: healthForDate(s.health, d).hrvMs }))
    .filter((p): p is { label: string; value: number } => p.value != null);
  const hasRecovery = sleep.some((x) => x.value) || hrv.length > 1;

  // sessions per week for the last 8 weeks
  const weeks = Array.from({ length: 8 }).map((_, i) => {
    const end = new Date();
    end.setDate(end.getDate() - 7 * (7 - i));
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    const n = finished(s.workouts).filter((w) => {
      const t = new Date(w.startedAt);
      return t > start && t <= end;
    }).length;
    return { label: `${end.getMonth() + 1}/${end.getDate()}`, value: n };
  });

  const measurements = [...s.body].reverse().slice(0, 8);
  const bf = latestBody(s.body, 'bodyFatPct');
  const activeTargets = s.targets.filter((t) => t.status === 'active');
  const pastTargets = s.targets.filter((t) => t.status !== 'active');
  const [showPast, setShowPast] = useState(false);

  return (
    <Screen>
      <Eyebrow>Progress</Eyebrow>
      <Display style={{ marginTop: space(2) }}>
        Proof it’s <Italic>working.</Italic>
      </Display>

      {s.profile.goals.length ? (
        <Row gap={2} style={{ flexWrap: 'wrap', marginTop: space(4) }}>
          {s.profile.goals.map((g) => (
            <Chip key={g} label={GOAL_LABEL[g]} active />
          ))}
          <Chip label="Edit goals" icon="create-outline" onPress={() => router.push('/you')} />
        </Row>
      ) : null}

      <SectionHeader title="Targets" action="+ New" onAction={() => router.push('/target-new')} />
      {activeTargets.length ? (
        <View style={{ gap: space(3) }}>
          {activeTargets.map((t) => (
            <TargetCard key={t.id} t={t} />
          ))}
        </View>
      ) : (
        <Empty
          icon="flag-outline"
          title="Give your goals a finish line"
          text="A target is a number and a date — like a 135 lb hip thrust in 8 weeks. Set one yourself, or let your coach suggest a few."
        >
          <Row gap={2}>
            <Button title="New target" small onPress={() => router.push('/target-new')} />
            <Button title="Ask my coach" small variant="secondary" onPress={() => router.push('/coach')} />
          </Row>
        </Empty>
      )}
      {pastTargets.length ? (
        <Pressable onPress={() => setShowPast(!showPast)} style={{ marginTop: space(3) }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted }}>
            {showPast ? 'Hide' : 'Show'} finished & archived ({pastTargets.length})
          </Text>
        </Pressable>
      ) : null}
      {showPast ? (
        <View style={{ gap: space(3), marginTop: space(3) }}>
          {pastTargets.map((t) => (
            <TargetCard key={t.id} t={t} />
          ))}
        </View>
      ) : null}

      <SectionHeader title="Weight" action="+ Log" onAction={() => router.push('/log-body')} />
      {series.length < 2 ? (
        <Empty icon="scale-outline" title="Log a few weigh-ins" text="Once you have two or more, your trend line shows up here. Apple Health weigh-ins import automatically.">
          <Button title="Log weight" small onPress={() => router.push('/log-body')} />
        </Empty>
      ) : (
        <Card>
          <Row gap={4}>
            <Stat label="Current" value={last!.toFixed(1)} unit={wl} />
            <Stat label={`${range}d change`} value={`${change! > 0 ? '+' : ''}${change!.toFixed(1)}`} unit={wl} />
            {toGo != null ? <Stat label="To goal" value={Math.abs(toGo).toFixed(1)} unit={wl} /> : null}
          </Row>
          <View style={{ marginTop: space(5) }}>
            <LineChart data={series} width={chartW} goal={goal} />
          </View>
          <Row gap={2} style={{ marginTop: space(4) }}>
            {RANGES.map((r) => (
              <Chip key={r} label={r === 365 ? '1Y' : `${r}D`} active={range === r} onPress={() => setRange(r)} />
            ))}
          </Row>
        </Card>
      )}

      <SectionHeader title="Consistency" />
      <Card>
        <Body muted style={{ fontSize: 13, marginBottom: space(3) }}>
          Workouts per week · goal {s.profile.daysPerWeek}
        </Body>
        <Bars data={weeks} width={chartW} goal={s.profile.daysPerWeek} color={colors.burgundy} highlight={colors.olive} />
      </Card>

      <SectionHeader title="Recovery" />
      {hasRecovery ? (
        <Card>
          <Body muted style={{ fontSize: 13, marginBottom: space(3) }}>Sleep, last 14 nights (h)</Body>
          <Bars data={sleep} width={chartW} goal={7.5} color={colors.mocha} highlight={colors.olive} height={90} />
          {hrv.length > 1 ? (
            <>
              <Body muted style={{ fontSize: 13, marginTop: space(6), marginBottom: space(3) }}>HRV trend (ms)</Body>
              <LineChart data={hrv} width={chartW} height={100} color={colors.latte} />
            </>
          ) : null}
        </Card>
      ) : (
        <Empty icon="moon-outline" title="No recovery data yet" text="Connect Apple Health (RingConn syncs through it) or Oura in the You tab to see sleep and HRV.">
          <Button title="Connect a wearable" small variant="secondary" onPress={() => router.push('/you')} />
        </Empty>
      )}

      {measurements.length ? (
        <>
          <SectionHeader title="Log" />
          <Card style={{ paddingVertical: space(2) }}>
            {bf ? (
              <Text style={{ fontFamily: fonts.body, color: colors.textMuted, fontSize: 12, paddingVertical: space(2) }}>
                Latest body fat: {bf.bodyFatPct}%
              </Text>
            ) : null}
            {measurements.map((m, i) => (
              <Row key={m.id} style={{ paddingVertical: space(3), borderTopWidth: i || bf ? 1 : 0, borderTopColor: colors.line, justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.bodyMedium, color: colors.cream }}>
                  {new Date(m.date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ fontFamily: fonts.body, color: colors.textMuted, flex: 1, textAlign: 'right', marginRight: space(3) }}>
                  {[
                    m.weightKg != null && `${displayWeight(m.weightKg, u)} ${wl}`,
                    m.bodyFatPct != null && `${m.bodyFatPct}%`,
                    m.waistCm != null && `waist ${u === 'us' ? (m.waistCm / 2.54).toFixed(1) + '″' : m.waistCm.toFixed(0) + 'cm'}`,
                    m.hipsCm != null && `hips ${u === 'us' ? (m.hipsCm / 2.54).toFixed(1) + '″' : m.hipsCm.toFixed(0) + 'cm'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Pressable onPress={() => s.deleteBody(m.id)} hitSlop={10}>
                  <Icon name="close" size={15} color={colors.textFaint} />
                </Pressable>
              </Row>
            ))}
          </Card>
        </>
      ) : null}
      <View style={{ height: space(4) }} />
    </Screen>
  );
}
