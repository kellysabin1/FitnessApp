import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Icon, tap } from '../components/ui';
import { todayKey } from '../store';
import { colors, fonts, radius, space } from '../theme';
import { type Challenge, myTaskChecks, setTaskDone, TASK_POINTS } from './api';

/** Today's checklist for one challenge. Optimistic ticks; rolls back if the save fails. */
export function DailyTasks({ c, compact, onChanged }: { c: Challenge; compact?: boolean; onChanged?: () => void }) {
  const day = todayKey();
  const [done, setDone] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      myTaskChecks(c.id, day).then(setDone).catch(() => {});
    }, [c.id, day]),
  );

  const toggle = async (i: number) => {
    tap();
    const on = !done.includes(i);
    setDone((d) => (on ? [...d, i] : d.filter((x) => x !== i)));
    setErr(null);
    try {
      await setTaskDone(c.id, i, day, on);
      onChanged?.();
    } catch (e) {
      setDone((d) => (on ? d.filter((x) => x !== i) : [...d, i]));
      setErr((e as Error).message);
    }
  };

  return (
    <View style={{ gap: space(2) }}>
      {c.tasks.map((t, i) => {
        const on = done.includes(i);
        return (
          <Pressable
            key={i}
            onPress={() => toggle(i)}
            accessibilityLabel={`${t}${on ? ', done' : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(3),
              padding: compact ? space(2.5) : space(3),
              borderRadius: radius.md,
              backgroundColor: on ? 'rgba(107,105,71,0.28)' : colors.bgRaised,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: on ? colors.olive : colors.line,
                backgroundColor: on ? colors.olive : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {on ? <Icon name="checkmark" size={14} color={colors.cream} /> : null}
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: on ? colors.textMuted : colors.cream }}>{t}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint }}>+{TASK_POINTS}</Text>
          </Pressable>
        );
      })}
      {err ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.sand }}>{err}</Text> : null}
    </View>
  );
}

