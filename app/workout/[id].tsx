import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Eyebrow, Icon, Row, Screen, tap } from '@/src/components/ui';
import { CATEGORY_LABEL } from '@/src/exercises';
import { When, WhenPicker } from '@/src/components/WhenPicker';
import { whenLabel, workoutDurationMin } from '@/src/stats';
import { afterWorkoutSaved } from '@/src/social/after';
import { SetEntry, useStore, WorkoutExercise } from '@/src/store';
import { colors, fonts, radius, space } from '@/src/theme';
import { inputToKg, kgToInput, Units, weightLabel } from '@/src/units';

export default function WorkoutScreen() {
  const { id, logged } = useLocalSearchParams<{ id: string; logged?: string }>();
  const w = useStore((s) => s.workouts.find((x) => x.id === id));
  const units = useStore((s) => s.units);
  const update = useStore((s) => s.updateWorkout);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const [finishing, setFinishing] = useState(false);
  const [mood, setMood] = useState(4);
  const [editingWhen, setEditingWhen] = useState(false);
  const elapsed = useElapsed(w?.startedAt, w?.finishedAt);

  if (!w) {
    return (
      <Screen padTop={false}>
        <Body muted>This workout no longer exists.</Body>
      </Screen>
    );
  }

  const isDone = !!w.finishedAt;
  const setEx = (exId: string, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    update(w.id, (cur) => ({ ...cur, exercises: cur.exercises.map((e) => (e.id === exId ? fn(e) : e)) }));

  const confirmDelete = () => {
    const doDelete = () => {
      deleteWorkout(w.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (confirm('Delete this workout?')) doDelete();
    } else {
      Alert.alert('Delete workout?', 'This can’t be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isDone ? 'Workout' : elapsed,
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <Icon name="trash-outline" color={colors.textMuted} />
            </Pressable>
          ),
        }}
      />
      <Screen padTop={false}>
        {isDone ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Eyebrow>{`${whenLabel(w.startedAt)} · ${workoutDurationMin(w)} min`}</Eyebrow>
            <Pressable onPress={() => setEditingWhen((v) => !v)} hitSlop={10}>
              <Text style={styles.link}>{editingWhen ? 'Done' : 'Change'}</Text>
            </Pressable>
          </Row>
        ) : (
          <Eyebrow>In session</Eyebrow>
        )}
        {isDone && editingWhen ? (
          <Card style={{ marginTop: space(3) }}>
            <WhenPicker
              value={{ start: new Date(w.startedAt), durationMin: workoutDurationMin(w) }}
              onChange={(v: When) =>
                update(w.id, (cur) => ({
                  ...cur,
                  startedAt: v.start.toISOString(),
                  finishedAt: new Date(+v.start + v.durationMin * 60000).toISOString(),
                }))
              }
            />
          </Card>
        ) : null}
        <TextInput
          value={w.title}
          onChangeText={(title) => update(w.id, (cur) => ({ ...cur, title }))}
          style={styles.title}
          placeholderTextColor={colors.textFaint}
        />

        <View style={{ gap: space(4), marginTop: space(4) }}>
          {w.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              units={units}
              autoDone={isDone}
              onChange={(fn) => setEx(ex.id, fn)}
              onRemove={() => update(w.id, (cur) => ({ ...cur, exercises: cur.exercises.filter((e) => e.id !== ex.id) }))}
            />
          ))}
        </View>

        <Button
          title="Add exercise"
          icon="add"
          variant="secondary"
          style={{ marginTop: space(5) }}
          onPress={() => router.push({ pathname: '/exercise-picker', params: { workoutId: w.id } })}
        />

        <TextInput
          value={w.notes ?? ''}
          onChangeText={(notes) => update(w.id, (cur) => ({ ...cur, notes }))}
          placeholder="Notes — how did it feel?"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.notes}
        />

        {isDone ? (
          <Button title={logged ? 'Save workout' : 'Done'} icon="checkmark" style={{ marginTop: space(6) }} onPress={() => {
              // logged-after-the-fact workouts get announced to challenges; edits to old ones just sync
              afterWorkoutSaved(w.id, { announce: !!logged });
              router.back();
            }} />
        ) : null}

        {!isDone && !finishing && (
          <Button title="Finish workout" icon="checkmark" style={{ marginTop: space(6) }} onPress={() => setFinishing(true)} />
        )}

        {finishing && (
          <Card tone="tortoise" style={{ marginTop: space(6), gap: space(4) }}>
            <Text style={styles.cardTitle}>How did that feel?</Text>
            <Row gap={2} style={{ justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => { tap(); setMood(m); }}
                  style={[styles.mood, mood === m && { backgroundColor: colors.latte, borderColor: colors.latte }]}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, color: mood === m ? colors.bg : colors.cream }}>{m}</Text>
                </Pressable>
              ))}
            </Row>
            <Body muted style={{ fontSize: 12, textAlign: 'center' }}>1 = rough · 5 = that girl</Body>
            <Button
              title="Save workout"
              onPress={() => {
                finishWorkout(w.id, mood);
                afterWorkoutSaved(w.id, { announce: true });
                router.back();
              }}
            />
          </Card>
        )}
      </Screen>
    </>
  );
}

function ExerciseCard({
  ex,
  units,
  autoDone,
  onChange,
  onRemove,
}: {
  ex: WorkoutExercise;
  units: Units;
  /** Past workouts: typing a value marks the set done automatically. */
  autoDone?: boolean;
  onChange: (fn: (e: WorkoutExercise) => WorkoutExercise) => void;
  onRemove: () => void;
}) {
  const cols = columnsFor(ex.kind, units, ex.category === 'cardio');
  const setSet = (i: number, patch: Partial<SetEntry>) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  return (
    <Card style={{ padding: space(4) }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{ex.name}</Text>
          <Text style={styles.meta}>{CATEGORY_LABEL[ex.category]}</Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Icon name="close" size={18} color={colors.textFaint} />
        </Pressable>
      </Row>

      <Row gap={2} style={{ marginTop: space(3), paddingHorizontal: space(1) }}>
        <Text style={[styles.colHead, { width: 28 }]}>SET</Text>
        {cols.map((c) => (
          <Text key={c.key} style={[styles.colHead, { flex: 1 }]}>{c.label}</Text>
        ))}
        <View style={{ width: 36 }} />
      </Row>

      {ex.sets.map((set, i) => (
        <Row key={i} gap={2} style={[styles.setRow, set.done && { backgroundColor: 'rgba(95,99,64,0.28)' }]}>
          <Text style={[styles.setNum, { width: 28 }]}>{i + 1}</Text>
          {cols.map((c) => (
            <NumInput key={c.key} value={c.get(set)} onCommit={(v) => setSet(i, { ...c.set(v), ...(autoDone && v.trim() ? { done: true } : {}) })} placeholder="—" />
          ))}
          <Pressable
            onPress={() => { tap(); setSet(i, { done: !set.done }); }}
            style={[styles.check, set.done && { backgroundColor: colors.olive, borderColor: colors.olive }]}
          >
            <Icon name="checkmark" size={16} color={set.done ? colors.cream : colors.textFaint} />
          </Pressable>
        </Row>
      ))}

      <Row style={{ justifyContent: 'space-between', marginTop: space(2) }}>
        <Pressable
          onPress={() => onChange((e) => ({ ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1], done: false }] }))}
          style={styles.smallBtn}
        >
          <Text style={styles.smallBtnText}>+ Add set</Text>
        </Pressable>
        {ex.sets.length > 1 ? (
          <Pressable onPress={() => onChange((e) => ({ ...e, sets: e.sets.slice(0, -1) }))} style={styles.smallBtn}>
            <Text style={[styles.smallBtnText, { color: colors.textMuted }]}>Remove set</Text>
          </Pressable>
        ) : null}
      </Row>
    </Card>
  );
}

type Col = { key: string; label: string; get: (s: SetEntry) => string; set: (v: string) => Partial<SetEntry> };
function columnsFor(kind: WorkoutExercise['kind'], units: Units, isCardio: boolean): Col[] {
  const reps: Col = { key: 'reps', label: 'REPS', get: (s) => (s.reps != null ? String(s.reps) : ''), set: (v) => ({ reps: toNum(v) }) };
  const weight: Col = {
    key: 'w',
    label: weightLabel(units).toUpperCase(),
    get: (s) => kgToInput(s.weightKg, units),
    set: (v) => ({ weightKg: inputToKg(v, units) }),
  };
  const mins: Col = {
    key: 'min',
    label: 'MIN',
    get: (s) => (s.seconds != null ? String(Math.round((s.seconds / 60) * 10) / 10) : ''),
    set: (v) => ({ seconds: toNum(v) != null ? Math.round(toNum(v)! * 60) : undefined }),
  };
  const secs: Col = { key: 'sec', label: 'SEC', get: (s) => (s.seconds != null ? String(s.seconds) : ''), set: (v) => ({ seconds: toNum(v) }) };
  const dist: Col = {
    key: 'd',
    label: units === 'us' ? 'MI' : 'KM',
    get: (s) => (s.distanceKm != null ? String(Math.round((units === 'us' ? s.distanceKm / 1.609344 : s.distanceKm) * 100) / 100) : ''),
    set: (v) => {
      const n = toNum(v);
      return { distanceKm: n == null ? undefined : units === 'us' ? n * 1.609344 : n };
    },
  };
  switch (kind) {
    case 'weighted':
      return [weight, reps];
    case 'bodyweight':
      return [reps];
    case 'timed':
      return [isCardio ? mins : secs];
    case 'distance':
      return [dist, mins];
  }
}

const toNum = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
};

/** Number input that keeps its own text (so "12." doesn't get eaten) and commits on change. */
function NumInput({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (toNum(text) !== toNum(value)) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        onCommit(t);
      }}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      style={styles.num}
      selectTextOnFocus
    />
  );
}

function useElapsed(start?: string, end?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  if (!start) return '';
  const ms = (end ? +new Date(end) : now) - +new Date(start);
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.cream, marginTop: space(1), padding: 0, outlineStyle: 'none' as never },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  colHead: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.2, color: colors.textFaint, textAlign: 'center' },
  setRow: { paddingVertical: space(1.5), paddingHorizontal: space(1), borderRadius: radius.sm, marginTop: space(1) },
  setNum: { fontFamily: fonts.bodyBold, color: colors.textMuted, textAlign: 'center' },
  num: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 40,
    outlineStyle: 'none' as never,
    textAlign: 'center',
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    backgroundColor: colors.bgRaised,
    borderRadius: radius.sm,
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.latte },
  smallBtn: { paddingVertical: space(2), paddingHorizontal: space(1) },
  smallBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.latte },
  notes: {
    marginTop: space(5),
    minHeight: 80,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 15,
    padding: space(4),
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    textAlignVertical: 'top',
    outlineStyle: 'none' as never,
  },
  mood: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
