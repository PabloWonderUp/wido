import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";
import { applyRemoteState } from "@/hooks/store";
import { coerceState } from "@/lib/storage";

/**
 * Live cross-device sync. While signed in we subscribe to this user's single
 * `app_state` row; whenever any device writes it, we apply the new state to the
 * store (without re-persisting), so every open device stays current.
 *
 * Requires Realtime to be enabled for the table (see supabase/schema.sql):
 *   alter publication supabase_realtime add table public.app_state;
 * If it isn't enabled this silently no-ops; the focus/online reload still syncs.
 */
let channel: RealtimeChannel | null = null;

export function subscribeToCloud(userId: string) {
  const sb = getSupabase();
  if (!sb) return;
  unsubscribeFromCloud();
  channel = sb
    .channel(`app_state:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "app_state",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = (payload.new ?? {}) as { state?: unknown };
        if (row.state) applyRemoteState(coerceState(row.state));
      }
    )
    .subscribe();
}

export function unsubscribeFromCloud() {
  if (channel) {
    getSupabase()?.removeChannel(channel);
    channel = null;
  }
}
