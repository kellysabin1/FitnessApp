import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useStore } from '@/src/store';
import { colors, fonts } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.cream, primary: colors.gold, border: colors.line },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());

  useEffect(() => {
    if (error) throw error;
  }, [error]);
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);
  useEffect(() => {
    if (loaded && hydrated) SplashScreen.hideAsync();
  }, [loaded, hydrated]);

  if (!loaded || !hydrated) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.cream,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: '' }} />
        <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', title: 'Add exercise' }} />
        <Stack.Screen name="log-body" options={{ presentation: 'modal', title: 'Log body' }} />
      </Stack>
    </ThemeProvider>
  );
}
