import { getSupabase } from "@/lib/supabase";
import type { AppState } from "../types";
import { coerceState, type StorageAdapter } from "./index";
import { getActiveUser } from "./active-user";

/**
 * Cloud backend: one `app_state` row per user holding the whole AppState as
 * JSON (see supabase/schema.sql). Row-Level Security keeps it private.
 * Used only while signed in; falls back to empty if unavailable.
 */
const EMPTY: AppState = { tasks: [], clients: [] };

export const supabaseAdapter: StorageAdapter = {
  async load(): Promise<AppState> {
    const sb = getSupabase();
    const userId = getActiveUser();
    if (!sb || !userId) return EMPTY;
    const { data, error } = await sb
      .from("app_state")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return EMPTY;
    return coerceState(data.state);
  },

  async save(state: AppState): Promise<void> {
    const sb = getSupabase();
    const userId = getActiveUser();
    if (!sb || !userId) return;
    await sb.from("app_state").upsert(
      {
        user_id: userId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  },
};
