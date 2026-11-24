import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL, socialEnabled } from '../config';

let client: SupabaseClient | null = null;

/** The shared Supabase client, or null when friends & challenges aren't configured. */
export function sb(): SupabaseClient | null {
  if (!socialEnabled()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    if (Platform.OS !== 'web') {
      // Keep the login fresh only while the app is open.
      AppState.addEventListener('change', (state) => {
        if (state === 'active') client?.auth.startAutoRefresh();
        else client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}

export function requireSb(): SupabaseClient {
  const c = sb();
  if (!c) throw new Error('Friends & challenges aren’t set up yet.');
  return c;
}

/** Turn Supabase/Postgres errors into short, human messages. */
export function friendly(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/User already registered/i.test(msg)) return 'That email already has an account — sign in instead.';
  if (/Password should be at least/i.test(msg)) return 'Password needs at least 8 characters.';
  if (/profiles_username_key|duplicate key.*username/i.test(msg)) return 'That username is taken.';
  if (/profiles_username_check/i.test(msg)) return 'Usernames are 3–20 lowercase letters, numbers or _.';
  if (/friendships_pair|friendships_pkey/i.test(msg)) return 'You already have a request with this person.';
  if (/Failed to fetch|Network request failed/i.test(msg)) return 'Can’t reach the server — check your internet.';
  return msg;
}
