import { router, Stack } from 'expo-router';
import { Body, Button, Display, Screen } from '@/src/components/ui';
import { space } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen>
        <Display>Lost?</Display>
        <Body muted style={{ marginVertical: space(4) }}>
          This screen doesn’t exist.
        </Body>
        <Button title="Back to Today" onPress={() => router.replace('/')} />
      </Screen>
    </>
  );
}
