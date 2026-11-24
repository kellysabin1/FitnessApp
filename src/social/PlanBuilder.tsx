import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Field, Icon, Row } from '../components/ui';
import { allExercises } from '../exercises';
import { TEMPLATES } from '../templates';
import { colors, fonts, radius, space } from '../theme';
import type { PlanItem } from './api';

/** Build a challenge's group plan: start from routines and/or make custom workouts. */
export function PlanBuilder({ value, onChange }: { value: PlanItem[]; onChange: (p: PlanItem[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null); // index being edited, -1 = new
  const titles = new Set(value.map((p) => p.title.toLowerCase()));

  const toggleRoutine = (t: (typeof TEMPLATES)[number]) => {
    if (titles.has(t.title.toLowerCase())) onChange(value.filter((p) => p.title.toLowerCase() !== t.title.toLowerCase()));
    else onChange([...value, { title: t.title, exercises: t.exercises }]);
  };

  return (
    <View style={{ gap: space(3) }}>
      {value.map((p, i) =>
        editing === i ? (
          <WorkoutEditor
            key={i}
            initial={p}
            taken={new Set([...titles].filter((t) => t !== p.title.toLowerCase()))}
            onCancel={() => setEditing(null)}
            onSave={(item) => {
              onChange(value.map((x, j) => (j === i ? item : x)));
              setEditing(null);
            }}
          />
        ) : (
          <Card key={i} style={{ padding: space(4) }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: space(2) }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.cream }}>{p.title}</Text>
                <Body muted numberOfLines={2} style={{ fontSize: 13 }}>
                  {p.exercises.length ? p.exercises.join(' · ') : 'No exercises yet'}
                </Body>
              </View>
              <Row gap={4}>
                <Pressable onPress={() => setEditing(i)} hitSlop={8}>
                  <Icon name="create-outline" size={18} color={colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => onChange(value.filter((_, j) => j !== i))} hitSlop={8}>
                  <Icon name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </Row>
            </Row>
          </Card>
        ),
      )}

      {editing === -1 ? (
        <WorkoutEditor
          taken={titles}
          onCancel={() => setEditing(null)}
          onSave={(item) => {
            onChange([...value, item]);
            setEditing(null);
          }}
        />
      ) : (
        <Button title="Create a custom workout" icon="add" variant="secondary" small onPress={() => setEditing(-1)} />
      )}

      <Text style={label}>Or add a routine</Text>
      <Row gap={2} style={{ flexWrap: 'wrap' }}>
        {TEMPLATES.map((t) => (
          <Chip key={t.title} label={t.title} active={titles.has(t.title.toLowerCase())} onPress={() => toggleRoutine(t)} />
        ))}
      </Row>
    </View>
  );
}

function WorkoutEditor({
  initial,
  taken,
  onSave,
  onCancel,
}: {
  initial?: PlanItem;
  taken: Set<string>;
  onSave: (p: PlanItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [exercises, setExercises] = useState<string[]>(initial?.exercises ?? []);
  const [q, setQ] = useState('');

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const EXERCISES = allExercises();
    const found = EXERCISES.filter(
      (e) => !exercises.includes(e.name) && (e.name.toLowerCase().includes(t) || e.muscle.toLowerCase().includes(t)),
    )
      .slice(0, 8)
      .map((e) => e.name);
    const exact = EXERCISES.some((e) => e.name.toLowerCase() === t) || exercises.some((e) => e.toLowerCase() === t);
    return exact ? found : [...found, q.trim()];
  }, [q, exercises]);

  const duplicate = taken.has(title.trim().toLowerCase());
  const valid = title.trim().length > 0 && !duplicate && exercises.length > 0;

  return (
    <Card style={{ gap: space(3), borderColor: 'rgba(216,193,166,0.3)' }}>
      <Field label="Workout name" value={title} onChangeText={setTitle} placeholder="e.g. Week 1 · Lower body" />
      {duplicate ? <Text style={[label, { color: colors.sand }]}>You already have a plan workout with that name.</Text> : null}

      <Text style={label}>Exercises</Text>
      {exercises.length ? (
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {exercises.map((e) => (
            <Pressable
              key={e}
              onPress={() => setExercises((xs) => xs.filter((x) => x !== e))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: space(3),
                paddingVertical: space(1.5),
                borderRadius: radius.pill,
                backgroundColor: colors.burgundy,
              }}
            >
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.cream }}>{e}</Text>
              <Icon name="close" size={13} color={colors.textMuted} />
            </Pressable>
          ))}
        </Row>
      ) : (
        <Body muted style={{ fontSize: 13 }}>
          Search below and tap to add.
        </Body>
      )}
      <Field value={q} onChangeText={setQ} placeholder="Search exercises (e.g. hip thrust, pilates)" autoCapitalize="none" />
      {matches.length ? (
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {matches.map((m, i) => (
            <Chip
              key={m}
              icon="add"
              label={i === matches.length - 1 && !allExercises().some((e) => e.name === m) ? `Add “${m}”` : m}
              onPress={() => {
                setExercises((xs) => [...xs, m]);
                setQ('');
              }}
            />
          ))}
        </Row>
      ) : null}

      <Row gap={2} style={{ marginTop: space(1) }}>
        <Button
          small
          title="Save workout"
          disabled={!valid}
          style={{ flex: 1 }}
          onPress={() => onSave({ title: title.trim(), exercises })}
        />
        <Button small variant="ghost" title="Cancel" onPress={onCancel} />
      </Row>
    </Card>
  );
}

const label = { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 } as const;
