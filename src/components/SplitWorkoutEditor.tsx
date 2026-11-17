import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { allExercises } from '../exercises';
import { colors, fonts, radius, space } from '../theme';
import type { PlannedExercise, SplitWorkout } from '../training';
import { Button, Card, Chip, Field, Icon, Row } from './ui';

/** Edit one workout in a split: name, focus, and exercises with sets × reps. */
export function SplitWorkoutEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: SplitWorkout;
  onSave: (w: SplitWorkout) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [focus, setFocus] = useState(initial.focus ?? '');
  const [items, setItems] = useState<PlannedExercise[]>(initial.exercises);
  const [q, setQ] = useState('');

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const lib = allExercises();
    const found = lib
      .filter((e) => !items.some((i) => i.name === e.name) && (e.name.toLowerCase().includes(t) || e.muscle.toLowerCase().includes(t)))
      .slice(0, 8)
      .map((e) => e.name);
    return lib.some((e) => e.name.toLowerCase() === t) ? found : [...found, q.trim()];
  }, [q, items]);

  const update = (i: number, patch: Partial<PlannedExercise>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const n = [...xs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <Card style={{ gap: space(3), borderColor: 'rgba(216,193,166,0.3)' }}>
      <Field label="Workout name" value={title} onChangeText={setTitle} placeholder="e.g. Lower A" />
      <Field label="Focus (optional)" value={focus} onChangeText={setFocus} placeholder="e.g. Strength: squat pattern" />
      <Text style={label}>Exercises · sets × reps</Text>
      {items.map((e, i) => (
        <Row key={e.name + i} gap={2} style={{ paddingVertical: space(1) }}>
          <View style={{ gap: 2 }}>
            <Pressable onPress={() => move(i, -1)} hitSlop={6} accessibilityLabel={`Move ${e.name} up`}>
              <Icon name="chevron-up" size={14} color={i ? colors.textMuted : colors.line} />
            </Pressable>
            <Pressable onPress={() => move(i, 1)} hitSlop={6} accessibilityLabel={`Move ${e.name} down`}>
              <Icon name="chevron-down" size={14} color={i < items.length - 1 ? colors.textMuted : colors.line} />
            </Pressable>
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.cream }} numberOfLines={2}>
            {e.name}
          </Text>
          <TextInput
            value={e.sets ? String(e.sets) : ''}
            onChangeText={(t) => update(i, { sets: parseInt(t, 10) || undefined })}
            keyboardType="number-pad"
            placeholder="3"
            placeholderTextColor={colors.textFaint}
            style={[mini, { width: 40 }]}
            accessibilityLabel={`${e.name} sets`}
          />
          <Text style={{ color: colors.textFaint }}>×</Text>
          <TextInput
            value={e.reps ?? ''}
            onChangeText={(t) => update(i, { reps: t.slice(0, 16) || undefined })}
            placeholder="8-10"
            placeholderTextColor={colors.textFaint}
            style={[mini, { width: 70 }]}
            accessibilityLabel={`${e.name} reps`}
          />
          <Pressable onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={`Remove ${e.name}`}>
            <Icon name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </Row>
      ))}
      <Field value={q} onChangeText={setQ} placeholder="Add an exercise (search)" autoCapitalize="none" />
      {matches.length ? (
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {matches.map((m, i) => (
            <Chip
              key={m}
              icon="add"
              label={i === matches.length - 1 && !allExercises().some((e) => e.name === m) ? `Add “${m}”` : m}
              onPress={() => {
                setItems((xs) => [...xs, { name: m, sets: 3, reps: '8-10' }]);
                setQ('');
              }}
            />
          ))}
        </Row>
      ) : null}
      <Row gap={2}>
        <Button
          small
          title="Save workout"
          style={{ flex: 1 }}
          disabled={!title.trim() || items.length === 0}
          onPress={() => onSave({ ...initial, title: title.trim(), focus: focus.trim() || undefined, exercises: items })}
        />
        <Button small variant="ghost" title="Cancel" onPress={onCancel} />
      </Row>
    </Card>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
const mini = {
  height: 36,
  textAlign: 'center' as const,
  color: colors.cream,
  fontFamily: fonts.bodyMedium,
  fontSize: 14,
  backgroundColor: colors.bgRaised,
  borderRadius: radius.sm,
  outlineStyle: 'none' as never,
};
