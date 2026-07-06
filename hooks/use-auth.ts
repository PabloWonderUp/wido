"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** Auth state + actions. No-ops gracefully when Supabase isn't configured. */
export function useAuth() {
  const configured = isSupabaseConfigured();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(configured);

  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = React.useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  return { configured, user, loading, signInWithGoogle, signOut };
}
