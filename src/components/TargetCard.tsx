import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useStore } from '../store';
import { colors, fonts, radius, space } from '../theme';
import { describeTarget, fmtTargetValue, type Target, TARGET_KIND_LABEL, targetStatus, targetUnit } from '../training';
import { Card, Eyebrow, Row } from './ui';

/** Progress bar with a tick where you'd be "on pace" by now. */
export function ProgressBar({ progress, expected }: { progress: number; expected?: number }) {
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.bgRaised, overflow: 'visible', marginTop: space(3) }}>
      <View style={{ width: `${Math.round(progress * 100)}%`, height: 8, borderRadius: radius.pill, backgroundColor: colors.latte }} />
      {expected != null && expected > 0 && expected < 1 ? (
        <View
          style={{
            position: 'absolute',
            left: `${Math.round(expected * 100)}%`,
            top: -3,
            width: 2,
            height: 14,
            backgroundColor: colors.sand,
            borderRadius: 1,
          }}
        />
      ) : null}
    </View>
  );
}

export function StatusPill({ t }: { t: Target }) {
  // select each slice separately — returning a new object from one selector would re-render forever
  const workouts = useStore((s) => s.workouts);
  const body = useStore((s) => s.body);
  const health = useStore((s) => s.health);
  const st = targetStatus(t, { workouts, body, health });
  const label =
    t.status === 'done'
      ? 'Done ✓'
      : st.reached
        ? 'Reached ✓'
        : st.current == null
          ? 'Needs a check-in'
          : st.onTrack
            ? 'On track'
            : 'Behind pace';
  const good = t.status === 'done' || st.reached || st.onTrack;
  return (
    <View
      style={{
        paddingHorizontal: space(2.5),
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: good && st.current != null ? 'rgba(107,105,71,0.35)' : 'rgba(99,58,56,0.45)',
      }}
    >
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.cream }}>{label}</Text>
    </View>
  );
}

export function TargetCard({ t }: { t: Target }) {
  const units = useStore((s) => s.units);
  const workouts = useStore((s) => s.workouts);
  const body = useStore((s) => s.body);
  const health = useStore((s) => s.health);
  const st = targetStatus(t, { workouts, body, health });
  const unit = targetUnit(t, units);
  return (
    <Card onPress={() => router.push({ pathname: '/target/[id]', params: { id: t.id } })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow color={colors.textMuted}>{TARGET_KIND_LABEL[t.kind]}</Eyebrow>
        <StatusPill t={t} />
      </Row>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.cream, marginTop: space(1) }}>{t.title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted }}>{describeTarget(t, units)}</Text>
      <ProgressBar progress={st.progress} expected={t.status === 'active' ? st.expected : undefined} />
      <Row style={{ justifyContent: 'space-between', marginTop: space(2) }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}>
          Now {fmtTargetValue(t, st.current, units)}
          {unit && st.current != null ? ` ${unit}` : ''} · {Math.round(st.progress * 100)}%
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}>
          {t.status === 'active'
            ? `${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left`
            : t.status === 'done'
              ? 'Completed'
              : 'Archived'}
        </Text>
      </Row>
    </Card>
  );
}
