import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, SectionHeader } from '../components/ui';
import { socialEnabled } from '../config';
import { todayKey, useStore } from '../store';
import { colors, fonts, space } from '../theme';
import { type Challenge, myChallenges } from './api';
import { DailyTasks } from './DailyTasks';

/** Today screen: daily tasks from every running challenge, ready to tick off. Hidden if there are none. */
export function TodayTasks() {
  const signedIn = useStore((s) => !!s.account?.username);
  const [list, setList] = useState<Challenge[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn || !socialEnabled()) return;
      const day = todayKey();
      myChallenges()
        .then((cs) => setList(cs.filter((c) => c.tasks?.length && c.starts_on <= day && day <= c.ends_on)))
        .catch(() => {});
    }, [signedIn]),
  );

  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Today’s tasks" />
      <View style={{ gap: space(3) }}>
        {list.map((c) => (
          <Card key={c.id} style={{ gap: space(3), padding: space(4) }}>
            <Pressable onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: c.id } })}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4 }}>{c.name} ›</Text>
            </Pressable>
            <DailyTasks c={c} compact />
          </Card>
        ))}
      </View>
    </>
  );
}
