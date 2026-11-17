import { Redirect, router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Display, Eyebrow, Heart, Italic, Row } from '@/src/components/ui';
import { PickUsername, SignIn } from './account';
import { useStore } from '@/src/store';
import { finishSetup } from '@/src/social/invite';
import { colors, fonts, space } from '@/src/theme';

/**
 * First screen of the app: an account is required.
 * - New here → create account → pick @username → onboarding.
 * - Signing in on a new phone → everything is restored → straight to Today.
 * - Existing users from before accounts were required → create account; on-phone data is kept and backed up.
 */
export default function Welcome() {
  const account = useStore((s) => s.account);
  const onboarded = useStore((s) => s.onboarded);
  const hasLocalData = useStore((s) => s.onboarded || s.workouts.length > 0);
  const suggested = useStore((s) => s.account?.displayName || s.profile.name);

  const next = () => (useStore.getState().onboarded ? finishSetup() : router.replace('/onboarding'));

  const invite = useStore((s) => s.pendingInvite);
  if (account?.username) {
    if (!onboarded) return <Redirect href="/onboarding" />;
    return invite ? <Redirect href={{ pathname: '/join/[code]', params: { code: invite } }} /> : <Redirect href="/" />;
  }
  if (account) return <PickUsername suggested={suggested ?? ''} onDone={next} padTop />;

  return (
    <SignIn
      padTop
      intro={
        <View style={{ gap: space(4) }}>
          <Row gap={3}>
            <Heart size={26} />
            <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.cream }}>rep.</Text>
          </Row>
          {hasLocalData ? (
            <>
              <Eyebrow>One quick step</Eyebrow>
              <Display>
                Create your <Italic>account.</Italic>
              </Display>
              <Body muted>
                rep. now saves everything to your account — your workouts and progress on this phone stay put and get backed up.
              </Body>
            </>
          ) : (
            <>
              <Eyebrow>Welcome</Eyebrow>
              <Display>
                Train smarter. <Italic>Get stronger.</Italic>
              </Display>
              <Body muted>Create an account to get started, or sign in to pick up where you left off.</Body>
            </>
          )}
        </View>
      }
    />
  );
}
