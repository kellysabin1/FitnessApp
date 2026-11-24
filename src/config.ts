// Public settings for the friends & challenges backend (Supabase).
// The URL and anon/publishable key are designed to be public — security comes from the
// row-level-security rules in supabase/schema.sql, not from hiding these.
// Fill these in (or set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kkhpfyxrestlohjvpcit.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Szhjbt3ao674iC7mtvfdwQ_zTM_fV3Z';

export const socialEnabled = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/** Public web address of the rep. app (used in invite links from the native app). */
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

/**
 * The rep. server that sends notifications (same server as the AI coach).
 * Built into the app so friends get notifications even without the coach password.
 */
export const PUSH_SERVER_URL = process.env.EXPO_PUBLIC_PUSH_SERVER_URL || 'https://rep-coach.onrender.com';
export const PRIVACY_CONTACT = process.env.EXPO_PUBLIC_PRIVACY_CONTACT || 'ksabin999@gmail.com';
/** Who runs rep. and which law governs the terms — shown in the Privacy Policy and Terms (src/legal.ts). */
export const OPERATOR_NAME = process.env.EXPO_PUBLIC_OPERATOR_NAME || 'Kelly O’Reilly';
export const GOVERNING_LAW = process.env.EXPO_PUBLIC_GOVERNING_LAW || 'the Commonwealth of Virginia';
