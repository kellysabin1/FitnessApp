import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DarkTheme, ErrorBoundary as RouterErrorBoundary, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { reportError, watchGlobalErrors } from '@/src/errors';
import { useStore } from '@/src/store';
import { restoreSession } from '@/src/social/api';
import { registerServiceWorker } from '@/src/social/push';
import { ensureReminders } from '@/src/social/reminders';
import { startAutoSync } from '@/src/social/autosync';
import { colors, fonts } from '@/src/theme';

/** Expo Router's error screen, plus a scrubbed crash report so we hear about it. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => reportError(props.error), [props.error]);
  return <RouterErrorBoundary {...props} />;
}

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.cream, primary: colors.latte, border: colors.line },
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
  useEffect(() => {
    if (!hydrated) return;
    restoreSession()
      .then(() => ensureReminders())
      .catch(() => {});
    registerServiceWorker();
    watchGlobalErrors();
    startAutoSync();
  }, [hydrated]);

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
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: '' }} />
        <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', title: 'Add exercise' }} />
        <Stack.Screen name="log-body" options={{ presentation: 'modal', title: 'Log body' }} />
        <Stack.Screen name="log-past" options={{ presentation: 'modal', title: 'Log a past workout' }} />
        <Stack.Screen name="log-steps" options={{ presentation: 'modal', title: 'Log steps' }} />
        <Stack.Screen name="account" options={{ presentation: 'modal', title: 'Your account' }} />
        <Stack.Screen name="add-friend" options={{ presentation: 'modal', title: 'Add a friend' }} />
        <Stack.Screen name="challenge-new" options={{ presentation: 'modal', title: 'New challenge' }} />
        <Stack.Screen name="join" options={{ presentation: 'modal', title: 'Join with code' }} />
        <Stack.Screen name="challenge/[id]" options={{ title: '' }} />
        <Stack.Screen name="split/[id]" options={{ title: '' }} />
        <Stack.Screen name="split-new" options={{ presentation: 'modal', title: 'New split' }} />
        <Stack.Screen name="target/[id]" options={{ title: '' }} />
        <Stack.Screen name="target-new" options={{ presentation: 'modal', title: 'New target' }} />
        <Stack.Screen name="reminders" options={{ presentation: 'modal', title: 'Reminders' }} />
        <Stack.Screen name="privacy" options={{ presentation: 'modal', title: 'Privacy Policy' }} />
        <Stack.Screen name="terms" options={{ presentation: 'modal', title: 'Terms of Use' }} />
        <Stack.Screen name="health-privacy" options={{ presentation: 'modal', title: 'Consumer Health Data Privacy Policy' }} />
        <Stack.Screen name="your-data" options={{ presentation: 'modal', title: 'Privacy & your data' }} />
        <Stack.Screen name="consent" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
