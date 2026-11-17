import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Button, Card, Display, Empty, Eyebrow, H2, Icon, Italic, Row, Screen, SectionHeader } from '@/src/components/ui';
import { finished, personalRecords, relativeDay, whenLabel, setsDone, workoutDurationMin, workoutVolumeKg } from '@/src/stats';
import { useStore, Workout } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import { addExercisesByName } from '@/src/workoutActions';
import { TEMPLATES } from '@/src/templates';
import { byGoals } from '@/src/splits';
import { UpNextCard } from '@/src/components/UpNext';
import { displayWeight, weightLabel } from '@/src/units';

export default function Train() {
  const s = useStore();
  const done = finished(s.workouts);
  const prs = personalRecords(s.workouts).slice(0, 6);
  const wl = weightLabel(s.units);

  const startFromTemplate = (t: (typeof TEMPLATES)[number]) => {
    const id = s.startWorkout(t.title);
    addExercisesByName(id, t.exercises);
    router.push(`/workout/${id}`);
  };

  return (
    <Screen>
      <Eyebrow>Train</Eyebrow>
      <Display style={{ marginTop: space(2) }}>
        Lift, flow, <Italic>repeat.</Italic>
      </Display>

      <UpNextCard style={{ marginTop: space(6) }} />

      <Button
        title="Start empty workout"
        icon="add"
        style={{ marginTop: space(6) }}
        onPress={() => router.push(`/workout/${s.startWorkout()}`)}
      />
      <Button
        title="Log a past workout"
        icon="time-outline"
        variant="secondary"
        style={{ marginTop: space(3) }}
        onPress={() => router.push('/log-past')}
      />

      <SectionHeader title="Your splits" action="+ New split" onAction={() => router.push('/split-new')} />
      {s.splits.length === 0 ? (
        <Empty icon="folder-open-outline" title="No splits yet" text="A split is a folder of workouts you rotate through. Build your own, let your coach design one, or start from a ready-made split.">
          <Button title="Create a split" icon="add" onPress={() => router.push('/split-new')} />
        </Empty>
      ) : (
        <View style={{ gap: space(3) }}>
          {s.splits.map((sp) => (
            <Card key={sp.id} onPress={() => router.push({ pathname: '/split/[id]', params: { id: sp.id } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={2} style={{ flex: 1 }}>
                  <Icon name={sp.id === s.activeSplitId ? 'folder-open' : 'folder-outline'} size={18} color={sp.id === s.activeSplitId ? colors.latte : colors.textMuted} />
                  <H2 style={{ fontSize: 20, flex: 1 }} >{sp.name}</H2>
                </Row>
                {sp.id === s.activeSplitId ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.latte, letterSpacing: 1 }}>ACTIVE</Text> : null}
              </Row>
              <Body muted numberOfLines={1} style={{ fontSize: 13, marginTop: space(1) }}>
                {sp.workouts.length} workout{sp.workouts.length === 1 ? '' : 's'} · {sp.workouts.map((w) => w.title).join(' · ')}
              </Body>
            </Card>
          ))}
        </View>
      )}

      <SectionHeader title="Quick start" />
      <View style={{ gap: space(3) }}>
        {byGoals(TEMPLATES, s.profile.goals).map((t) => {
          const rec = (t.goals ?? []).some((g) => s.profile.goals.includes(g));
          return (
            <Card key={t.title} tone={t.tone} onPress={() => startFromTemplate(t)}>
              {rec ? <Eyebrow color={colors.latte} style={{ marginBottom: space(1) }}>Recommended for your goals</Eyebrow> : null}
              <H2 style={{ fontSize: 21 }}>{t.title}</H2>
              <Body muted numberOfLines={1} style={{ fontSize: 13 }}>{t.exercises.join(' · ')}</Body>
            </Card>
          );
        })}
      </View>

      {prs.length ? (
        <>
          <SectionHeader title="Personal records" />
          <Card>
            {prs.map((pr, i) => (
              <Row key={pr.name} style={{ justifyContent: 'space-between', paddingVertical: space(2.5), borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 15 }}>{pr.name}</Text>
                  <Text style={{ fontFamily: fonts.body, color: colors.textFaint, fontSize: 12 }}>
                    {displayWeight(pr.weightKg, s.units)} {wl} × {pr.reps} · {relativeDay(pr.date)}
                  </Text>
                </View>
                <Text style={{ fontFamily: fonts.display, color: colors.brass, fontSize: 22 }}>
                  {displayWeight(pr.e1rm, s.units, 0)}
                  <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.textMuted }}> {wl} 1RM</Text>
                </Text>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="History" />
      {done.length === 0 ? (
        <Empty icon="barbell-outline" title="No workouts yet" text="Your finished sessions will live here, with volume, duration and PRs." />
      ) : (
        <View style={{ gap: space(3) }}>
          {done.map((w) => (
            <HistoryCard key={w.id} w={w} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HistoryCard({ w }: { w: Workout }) {
  const units = useStore((s) => s.units);
  const vol = workoutVolumeKg(w);
  return (
    <Card onPress={() => router.push(`/workout/${w.id}`)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow color={colors.textMuted}>{whenLabel(w.startedAt)}</Eyebrow>
        {w.mood ? <Text style={{ color: colors.latte }}>{'✦'.repeat(w.mood)}</Text> : null}
      </Row>
      <H2 style={{ marginTop: space(1) }}>{w.title}</H2>
      <Body muted style={{ fontSize: 13 }}>
        {workoutDurationMin(w)} min · {w.exercises.length} exercises · {setsDone(w)} sets
        {vol ? ` · ${displayWeight(vol, units, 0)} ${weightLabel(units)} volume` : ''}
      </Body>
    </Card>
  );
}
