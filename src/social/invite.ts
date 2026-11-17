import { router } from 'expo-router';
import { useStore } from '../store';

/** After sign-up/onboarding: go to the challenge they were invited to, or Today. */
export function finishSetup() {
  const code = useStore.getState().pendingInvite;
  if (code) router.replace({ pathname: '/join/[code]', params: { code } });
  else router.replace('/');
}
