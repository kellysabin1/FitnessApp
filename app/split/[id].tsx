import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SplitWorkoutEditor } from '@/src/components/SplitWorkoutEditor';
import { Body, Button, Card, Divider, Eyebrow, H2, Icon, Row, Screen } from '@/src/components/ui';
import { startSplitWorkout } from '@/src/splits';
import { uid, useStore } from '@/src/store';
import { colors, fonts, space } from '@/src/theme';
import { type SplitWorkout, upNext } from '@/src/training';

const SOURCE_LABEL = {
  custom: 'Your split',
  ai: 'Built by your coach',
  template: 'Ready-made split',
  coach: 'Saved from your coach',
} as const;

export default function SplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const split = useStore((s) => s.splits.find((x) => x.id === id));
  const activeId = useStore((s) => s.activeSplitId);
  const workouts = useStore((s) => s.workouts);
  const saveSplit = useStore((s) => s.saveSplit);
  const deleteSplit = useStore((s) => s.deleteSplit);
  const setActive = useStore((s) => s.setActiveSplit);
  const [editing, setEditing] = useState<string | null>(null); // workout id or 'new'

  if (!split) {
    return (
      <Screen padTop={false}>
        <Body muted>This split no longer exists.</Body>
      </Screen>
    );
  }

  const active = split.id === activeId;
  const nxt = upNext(split, workouts);
  const setWorkouts = (ws: SplitWorkout[]) => saveSplit({ ...split, workouts: ws });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= split.workouts.length) return;
    const n = [...split.workouts];
    [n[i], n[j]] = [n[j], n[i]];
    setWorkouts(n);
  };

  const confirm = (title: string, msg: string, action: string, go: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) go();
    } else
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: 'destructive', onPress: go },
      ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              hitSlop={12}
              accessibilityLabel="Delete split"
              onPress={() =>
                confirm(
                  'Delete this split?',
                  `“${split.name}” and its workouts will be removed. Your logged workouts stay.`,
                  'Delete',
                  () => {
                    deleteSplit(split.id);
                    router.back();
                  },
                )
              }
            >
              <Icon name="trash-outline" color={colors.textMuted} />
            </Pressable>
          ),
        }}
      />
      <Screen padTop={false}>
        <Eyebrow>{SOURCE_LABEL[split.source]}</Eyebrow>
        <TextInput
          value={split.name}
          onChangeText={(name) => saveSplit({ ...split, name })}
          style={{
            fontFamily: fonts.display,
            fontSize: 32,
            color: colors.cream,
            padding: 0,
            marginTop: space(1),
            outlineStyle: 'none' as never,
          }}
          accessibilityLabel="Split name"
        />
        {split.notes ? (
          <Body muted style={{ fontSize: 14, marginTop: space(2) }}>
            {split.notes}
          </Body>
        ) : null}

        <Card style={{ marginTop: space(5), gap: space(2) }}>
          {active ? (
            <>
              <Row gap={2}>
                <Icon name="checkmark-circle" color={colors.olive} />
                <Text style={{ fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 15 }}>Your active split</Text>
              </Row>
              <Body muted style={{ fontSize: 13 }}>
                Up next shows on Today and Train. Missed a day? The next workout just waits for you.
              </Body>
              <Button small variant="ghost" title="Stop using this split" onPress={() => setActive(undefined)} />
            </>
          ) : (
            <>
              <Body muted style={{ fontSize: 13 }}>
                Make it active to see “Up next” on Today and Train.
              </Body>
              <Button
                small
                title="Make this my active split"
                icon="checkmark"
                onPress={() => setActive(split.id)}
                disabled={!split.workouts.length}
              />
            </>
          )}
        </Card>

        <Row style={{ justifyContent: 'space-between', marginTop: space(7), marginBottom: space(3) }}>
          <H2>Workouts</H2>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}>In order · rolls over missed days</Text>
        </Row>
        <View style={{ gap: space(3) }}>
          {split.workouts.map((w, i) =>
            editing === w.id ? (
              <SplitWorkoutEditor
                key={w.id}
                initial={w}
                onCancel={() => setEditing(null)}
                onSave={(nw) => {
                  setWorkouts(split.workouts.map((x) => (x.id === w.id ? nw : x)));
                  setEditing(null);
                }}
              />
            ) : (
              <Card key={w.id} tone={active && nxt?.workout.id === w.id ? 'satin' : 'default'} style={{ padding: space(4) }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    {active && nxt?.workout.id === w.id ? <Eyebrow color={colors.latte}>Up next</Eyebrow> : null}
                    <Text style={{ fontFamily: fonts.display, fontSize: 21, color: colors.cream }}>
                      {i + 1}. {w.title}
                    </Text>
                    {w.focus ? (
                      <Body muted style={{ fontSize: 13 }}>
                        {w.focus}
                      </Body>
                    ) : null}
                  </View>
                  <Row gap={3}>
                    <Pressable onPress={() => move(i, -1)} hitSlop={8} accessibilityLabel={`Move ${w.title} up`}>
                      <Icon name="arrow-up" size={16} color={i ? colors.textMuted : colors.line} />
                    </Pressable>
                    <Pressable onPress={() => move(i, 1)} hitSlop={8} accessibilityLabel={`Move ${w.title} down`}>
                      <Icon name="arrow-down" size={16} color={i < split.workouts.length - 1 ? colors.textMuted : colors.line} />
                    </Pressable>
                  </Row>
                </Row>
                <View style={{ marginTop: space(2), gap: 2 }}>
                  {w.exercises.map((e, k) => (
                    <Text key={k} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted }}>
                      {e.name}
                      {e.sets ? <Text style={{ color: colors.textFaint }}>{`  ${e.sets} × ${e.reps ?? ''}`}</Text> : null}
                    </Text>
                  ))}
                </View>
                <Row gap={2} style={{ marginTop: space(3) }}>
                  <Button
                    small
                    title="Start"
                    icon="play"
                    style={{ flex: 1 }}
                    onPress={() => router.push(`/workout/${startSplitWorkout(split, w)}`)}
                  />
                  <Button small variant="secondary" title="Edit" onPress={() => setEditing(w.id)} />
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={`Remove ${w.title}`}
                    onPress={() =>
                      confirm('Remove this workout?', w.title, 'Remove', () => setWorkouts(split.workouts.filter((x) => x.id !== w.id)))
                    }
                    style={{ padding: space(2) }}
                  >
                    <Icon name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </Row>
              </Card>
            ),
          )}
          {editing === 'new' ? (
            <SplitWorkoutEditor
              initial={{ id: uid(), title: '', exercises: [] }}
              onCancel={() => setEditing(null)}
              onSave={(nw) => {
                setWorkouts([...split.workouts, nw]);
                setEditing(null);
              }}
            />
          ) : (
            <Button title="Add a workout" icon="add" variant="secondary" onPress={() => setEditing('new')} />
          )}
        </View>
        <Divider />
      </Screen>
    </>
  );
}
