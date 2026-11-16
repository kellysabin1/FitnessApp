import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon, IconName } from '@/src/components/ui';
import { useStore } from '@/src/store';
import { colors, fonts } from '@/src/theme';

const tab = (title: string, icon: IconName, activeIcon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: unknown; focused: boolean }) => (
    <Icon name={focused ? activeIcon : icon} size={22} color={String(color)} />
  ),
});

export default function TabLayout() {
  const onboarded = useStore((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.latte,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 0.6 },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
          position: 'absolute',
        },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'sparkles-outline', 'sparkles')} />
      <Tabs.Screen name="train" options={tab('Train', 'barbell-outline', 'barbell')} />
      <Tabs.Screen name="progress" options={tab('Progress', 'analytics-outline', 'analytics')} />
      <Tabs.Screen name="coach" options={tab('Coach', 'chatbubble-ellipses-outline', 'chatbubble-ellipses')} />
      <Tabs.Screen name="you" options={tab('You', 'person-circle-outline', 'person-circle')} />
    </Tabs>
  );
}
