import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { startSplitWorkout } from '../splits';
import { useStore } from '../store';
import { colors, fonts, space } from '../theme';
import { upNext } from '../training';
import { Body, Button, Card, Eyebrow, H2, Row } from './ui';

/** "Up next" from the active split (rolling order). Renders nothing without an active split. */
export function UpNextCard({ style }: { style?: object }) {
  const split = useStore((s) => s.splits.find((x) => x.id === s.activeSplitId));
  const workouts = useStore((s) => s.workouts);
  if (!split) return null;
  const nxt = upNext(split, workouts);
  if (!nxt) return null;
  return (
    <Card tone="croc" style={style}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow color={colors.latte}>Up next · {split.name}</Eyebrow>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}>
          {nxt.index + 1} of {split.workouts.length}
        </Text>
      </Row>
      <H2 style={{ marginTop: space(1) }}>{nxt.workout.title}</H2>
      {nxt.workout.focus ? (
        <Body muted style={{ fontSize: 13 }}>
          {nxt.workout.focus}
        </Body>
      ) : null}
      <Body muted numberOfLines={2} style={{ fontSize: 13, marginTop: space(1) }}>
        {nxt.workout.exercises.map((e) => e.name).join(' · ')}
      </Body>
      <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
        <Button
          title="Start"
          icon="play"
          style={{ flex: 1 }}
          onPress={() => router.push(`/workout/${startSplitWorkout(split, nxt.workout)}`)}
        />
        <Button title="View split" variant="secondary" onPress={() => router.push({ pathname: '/split/[id]', params: { id: split.id } })} />
      </View>
    </Card>
  );
}
