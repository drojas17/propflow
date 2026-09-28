import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let warned = false;

/** Build-time flag for the local-only demo (downloads JSON instead of saving). */
export function isPublicMode(): boolean {
  return import.meta.env.VITE_PUBLIC_MODE === 'true';
}

/**
 * Lazily create the Supabase browser client. Returns null in public (local-only)
 * mode or when the env vars are missing, so importing this module never throws.
 */
export function getSupabase(): SupabaseClient | null {
  if (isPublicMode()) return null;
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    if (!warned) {
      warned = true;
      console.error(
        'Missing Supabase config: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
      );
    }
    return null;
  }
  client = createClient(url, anonKey);
  return client;
}

/** Throwing variant for data paths that require a live backend. */
export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured (public mode or missing env vars)');
  return sb;
}
