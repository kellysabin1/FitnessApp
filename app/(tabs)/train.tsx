import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Button, Card, Display, Empty, Eyebrow, H2, Italic, Row, Screen, SectionHeader } from '@/src/components/ui';
import { finished, personalRecords, relativeDay, setsDone, workoutDurationMin, workoutVolumeKg } from '@/src/stats';
import { useStore, Workout } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import { addExercisesByName } from '@/src/workoutActions';
import { displayWeight, weightLabel } from '@/src/units';

// Quick-start templates covering strength, pilates, mobility and cardio.
const TEMPLATES: { title: string; tone: 'croc' | 'tortoise' | 'satin' | 'stripe' | 'cocoa' | 'mocha'; exercises: string[] }[] = [
  { title: 'Glutes & hamstrings', tone: 'croc', exercises: ['Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Cable Kickback', 'Hip Abduction Machine'] },
  { title: 'Upper body sculpt', tone: 'stripe', exercises: ['Lat Pulldown', 'Dumbbell Bench Press', 'Seated Cable Row', 'Lateral Raise', 'Bicep Curl', 'Tricep Rope Pushdown'] },
  { title: 'Quads & core', tone: 'mocha', exercises: ['Goblet Squat', 'Leg Press', 'Walking Lunge', 'Leg Extension', 'Dead Bug', 'Plank'] },
  { title: 'Mat Pilates', tone: 'tortoise', exercises: ['The Hundred', 'Roll Up', 'Single Leg Stretch', 'Criss Cross', 'Side-Lying Leg Series', 'Swan'] },
  { title: 'Mobility reset', tone: 'satin', exercises: ['Cat-Cow', 'World’s Greatest Stretch', '90/90 Hip Switch', 'Pigeon Pose', 'Thoracic Rotation'] },
  { title: 'Zone 2 + walk', tone: 'stripe', exercises: ['Incline Walk', 'Zone 2 Cycling'] },
];

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

      <Button
        title="Start empty workout"
        icon="add"
        style={{ marginTop: space(6) }}
        onPress={() => router.push(`/workout/${s.startWorkout()}`)}
      />

      <SectionHeader title="Quick start" />
      <View style={{ gap: space(3) }}>
        {TEMPLATES.map((t) => (
          <Card key={t.title} tone={t.tone} onPress={() => startFromTemplate(t)}>
            <H2 style={{ fontSize: 21 }}>{t.title}</H2>
            <Body muted numberOfLines={1} style={{ fontSize: 13 }}>{t.exercises.join(' · ')}</Body>
          </Card>
        ))}
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
        <Eyebrow color={colors.textMuted}>{relativeDay(w.startedAt)}</Eyebrow>
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
