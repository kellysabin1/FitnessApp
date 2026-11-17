// Public settings for the friends & challenges backend (Supabase).
// The URL and anon/publishable key are designed to be public — security comes from the
// row-level-security rules in supabase/schema.sql, not from hiding these.
// Fill these in (or set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const socialEnabled = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/** Public web address of the rep. app (used in invite links from the native app). */
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

/**
 * The rep. server that sends notifications (same server as the AI coach).
 * Built into the app so friends get notifications even without the coach password.
 */
export const PUSH_SERVER_URL = process.env.EXPO_PUBLIC_PUSH_SERVER_URL ?? '';
