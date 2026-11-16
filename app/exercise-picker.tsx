import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Button, Chip, Field, Icon, Row, tap } from '@/src/components/ui';
import { CATEGORY_LABEL, EXERCISES, ExerciseCategory } from '@/src/exercises';
import { useStore } from '@/src/store';
import { colors, fonts, gradients, space } from '@/src/theme';
import { addExercisesByName } from '@/src/workoutActions';
import { LinearGradient } from 'expo-linear-gradient';

export default function ExercisePicker() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const workouts = useStore((s) => s.workouts);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ExerciseCategory | 'all' | 'recent'>('all');
  const [picked, setPicked] = useState<string[]>([]);

  const recent = useMemo(() => {
    const names: string[] = [];
    for (const w of workouts) for (const e of w.exercises) if (!names.includes(e.name)) names.push(e.name);
    return names.slice(0, 20);
  }, [workouts]);

  const list = useMemo(() => {
    const base =
      cat === 'recent'
        ? recent.map((n) => EXERCISES.find((e) => e.name === n) ?? { name: n, category: 'strength' as const, muscle: 'Custom', kind: 'weighted' as const })
        : EXERCISES.filter((e) => cat === 'all' || e.category === cat);
    const query = q.trim().toLowerCase();
    return query ? base.filter((e) => e.name.toLowerCase().includes(query) || e.muscle.toLowerCase().includes(query)) : base;
  }, [q, cat, recent]);

  const custom = q.trim() && !EXERCISES.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) ? q.trim() : null;
  const toggle = (n: string) => {
    tap();
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  };

  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
      <View style={{ padding: space(5), paddingBottom: space(2), gap: space(3) }}>
        <Field value={q} onChangeText={setQ} placeholder="Search exercises or muscles" autoFocus />
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          <Chip label="All" active={cat === 'all'} onPress={() => setCat('all')} />
          {recent.length ? <Chip label="Recent" active={cat === 'recent'} onPress={() => setCat('recent')} /> : null}
          {(Object.keys(CATEGORY_LABEL) as ExerciseCategory[]).map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </Row>
      </View>
      <FlatList
        data={list}
        keyExtractor={(e) => e.name}
        contentContainerStyle={{ paddingHorizontal: space(5), paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          custom ? (
            <Item name={`Add “${custom}”`} sub="Custom exercise" selected={picked.includes(custom)} onPress={() => toggle(custom)} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <Item name={item.name} sub={`${item.muscle} · ${CATEGORY_LABEL[item.category]}`} selected={picked.includes(item.name)} onPress={() => toggle(item.name)} />
        )}
      />
      {picked.length ? (
        <View style={{ position: 'absolute', left: space(5), right: space(5), bottom: space(10) }}>
          <Button
            title={`Add ${picked.length} exercise${picked.length > 1 ? 's' : ''}`}
            onPress={() => {
              if (workoutId) addExercisesByName(workoutId, picked);
              router.back();
            }}
          />
        </View>
      ) : null}
    </LinearGradient>
  );
}

function Item({ name, sub, selected, onPress }: { name: string; sub: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.cream }}>{name}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 }}>{sub}</Text>
        </View>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: selected ? colors.latte : colors.line,
            backgroundColor: selected ? colors.latte : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <Icon name="checkmark" size={15} color={colors.bg} /> : null}
        </View>
      </Row>
    </Pressable>
  );
}
