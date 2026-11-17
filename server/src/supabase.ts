// Server-side Supabase access (service role) + verifying a rep. user's login token.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Request } from 'express';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let admin: SupabaseClient | null = null;

export const supabaseConfigured = () => !!SUPABASE_URL && !!SERVICE_KEY;

/** Service-role client — bypasses row-level security, so only use it for server-decided actions. */
export function db(): SupabaseClient {
  if (!admin) admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export const bearer = (req: Request) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

/** The signed-in rep. user behind this request's `Authorization: Bearer <access token>`, or null. */
export async function userFromRequest(req: Request): Promise<User | null> {
  const token = bearer(req);
  if (!token || !supabaseConfigured()) return null;
  const { data, error } = await db().auth.getUser(token);
  return error ? null : data.user;
}
