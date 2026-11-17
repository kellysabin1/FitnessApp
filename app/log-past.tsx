import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Chip, Field, Row, Screen } from '@/src/components/ui';
import { isFuture, When, WhenPicker } from '@/src/components/WhenPicker';
import { useStore } from '@/src/store';
import { TEMPLATES } from '@/src/templates';
import { colors, fonts, space } from '@/src/theme';
import { addExercisesByName } from '@/src/workoutActions';

/** Default: this morning if it's afternoon or later, otherwise an hour ago. */
function defaultWhen(): When {
  const d = new Date();
  if (d.getHours() >= 12) {
    d.setHours(9, 0, 0, 0);
  } else {
    d.setHours(Math.max(0, d.getHours() - 1), 0, 0, 0);
  }
  return { start: d, durationMin: 45 };
}

export default function LogPastWorkout() {
  const logPast = useStore((s) => s.logPastWorkout);
  const [template, setTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<When>(defaultWhen);

  const pick = (t: string | null) => {
    setTemplate(t);
    setTitle(t ?? '');
  };

  const save = () => {
    const id = logPast(title.trim() || 'Workout', when.start, when.durationMin);
    const t = TEMPLATES.find((x) => x.title === template);
    if (t) addExercisesByName(id, t.exercises);
    router.replace({ pathname: '/workout/[id]', params: { id, logged: '1' } });
  };

  return (
    <Screen padTop={false} contentStyle={{ gap: space(6), paddingBottom: space(16) }}>
      <Body muted>Forgot to log live? Add it here, then fill in what you did.</Body>

      <View style={{ gap: space(2) }}>
        <Text style={label}>What did you do?</Text>
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          <Chip label="Start blank" active={template === null} onPress={() => pick(null)} />
          {TEMPLATES.map((t) => (
            <Chip key={t.title} label={t.title} active={template === t.title} onPress={() => pick(t.title)} />
          ))}
        </Row>
      </View>

      <Field label="Name" value={title} onChangeText={setTitle} placeholder="e.g. Morning glutes" />

      <WhenPicker value={when} onChange={setWhen} />

      <Button title="Add exercises & sets" icon="arrow-forward" disabled={isFuture(when)} onPress={save} />
    </Screen>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
