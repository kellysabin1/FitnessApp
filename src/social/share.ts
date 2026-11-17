import { Platform, Share } from 'react-native';
import { APP_URL } from '../config';

export function inviteLink(code: string) {
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : APP_URL;
  return base ? `${base.replace(/\/$/, '')}/join/${code}` : '';
}

/** Open the share sheet (or copy to clipboard on desktop browsers). Returns what happened. */
export async function shareInvite(code: string, challengeName: string): Promise<'shared' | 'copied' | 'failed'> {
  const link = inviteLink(code);
  const text = `Join my “${challengeName}” challenge on rep.${link ? `\n${link}` : ''}\nCode: ${code}`;
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : undefined;
      if (nav?.share) {
        await nav.share({ text });
        return 'shared';
      }
      await nav?.clipboard?.writeText(text);
      return 'copied';
    }
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
