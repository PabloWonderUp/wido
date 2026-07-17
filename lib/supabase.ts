import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client, created only when env vars are present. Everything auth/
 * cloud is gated on this so the app keeps working in local-only mode until
 * Supabase is configured.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (safe to expose; protected by RLS)
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // handles the OAuth redirect for a static SPA
      // PKCE over the default implicit flow: the callback carries a one-time
      // `?code=` exchanged fresh for a session, instead of long-lived tokens in
      // the URL hash. Fixes iOS/PWA "Session as retrieved from URL was issued
      // over 120s ago, URL could be stale" — a reopened/cached callback URL was
      // getting its stale token rejected, silently dropping the tablet into
      // local-only mode (where deletes never reached the cloud → resurrected).
      flowType: "pkce",
    },
  });
}

export function getSupabase(): SupabaseClient | null {
  return client;
}

export function isSupabaseConfigured(): boolean {
  return client !== null;
}
