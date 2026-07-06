"use client";

import * as React from "react";

import { useAuth } from "@/hooks/use-auth";
import { rehydrate } from "@/hooks/store";
import { setActiveUser } from "@/lib/storage/active-user";
import { localAdapter } from "@/lib/storage/local";
import { supabaseAdapter } from "@/lib/storage/supabase";

/**
 * Bridges auth → storage: switches the backend to Supabase while signed in
 * (else local), and seeds the cloud from local data on first login.
 * Renders nothing. No-ops entirely when Supabase isn't configured.
 */
export function AuthSync() {
  const { configured, user, loading } = useAuth();
  const uid = user?.id ?? null;

  React.useEffect(() => {
    if (!configured || loading) return;
    let cancelled = false;

    (async () => {
      if (uid) {
        setActiveUser(uid);
        // First login on this account: if the cloud is empty but there's
        // local data, push it up so nothing is lost.
        const cloud = await supabaseAdapter.load();
        if (cloud.tasks.length === 0 && cloud.clients.length === 0) {
          const local = await localAdapter.load();
          if (local.tasks.length > 0 || local.clients.length > 0) {
            await supabaseAdapter.save(local);
          }
        }
      } else {
        setActiveUser(null);
      }
      if (!cancelled) await rehydrate();
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, loading, uid]);

  return null;
}
