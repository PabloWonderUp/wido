"use client";

import * as React from "react";

import { useAuth } from "@/hooks/use-auth";
import { rehydrate } from "@/hooks/store";
import { setActiveUser } from "@/lib/storage/active-user";
import { localAdapter } from "@/lib/storage/local";
import { supabaseAdapter } from "@/lib/storage/supabase";
import { subscribeToCloud, unsubscribeFromCloud } from "@/lib/realtime";

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
        // local data, push it up so nothing is lost. Guarded: if the cloud
        // read fails we skip seeding entirely — never mistake an unreachable
        // cloud for an empty account (that path used to wipe accounts).
        try {
          const cloud = await supabaseAdapter.load();
          if (cloud.tasks.length === 0 && cloud.clients.length === 0) {
            const local = await localAdapter.load();
            if (local.tasks.length > 0 || local.clients.length > 0) {
              await supabaseAdapter.save(local);
            }
          }
        } catch (err) {
          console.error("[wido] cloud seed check failed", err);
        }
      } else {
        setActiveUser(null);
      }
      if (!cancelled) await rehydrate();
    })();

    // Live sync while signed in: subscribe to this user's cloud row, and reload
    // when the tab regains focus / the device comes back online (catches
    // anything Realtime misses across reconnects and backgrounded tabs).
    const reload = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void rehydrate();
      }
    };
    if (uid) {
      subscribeToCloud(uid);
      window.addEventListener("focus", reload);
      window.addEventListener("online", reload);
      document.addEventListener("visibilitychange", reload);
    }

    return () => {
      cancelled = true;
      unsubscribeFromCloud();
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [configured, loading, uid]);

  return null;
}
