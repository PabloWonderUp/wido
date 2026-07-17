import { getSupabase } from "@/lib/supabase";
import type { AppState } from "../types";
import { coerceState, type StorageAdapter } from "./index";
import { getActiveUser } from "./active-user";
import { mergeStates } from "@/lib/merge";

/**
 * Cloud backend: one `app_state` row per user holding the whole AppState as
 * JSON (see supabase/schema.sql). Row-Level Security keeps it private.
 * Used only while signed in; falls back to empty if unavailable.
 */
const EMPTY: AppState = { tasks: [], clients: [], notes: [] };

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
    // Distinguish "couldn't reach the cloud" from "no data yet": on error we
    // MUST throw so callers never mistake a failed read for an empty account
    // and overwrite good cloud data with nothing.
    if (error) throw new Error(`supabase load failed: ${error.message}`);
    if (!data) return EMPTY; // genuinely no row for this user yet
    return coerceState(data.state);
  },

  // Overwrite the whole row. Used for explicit import/restore only.
  async save(state: AppState): Promise<void> {
    const sb = getSupabase();
    const userId = getActiveUser();
    if (!sb || !userId) return;
    const { error } = await sb.from("app_state").upsert(
      {
        user_id: userId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    // Surface write failures instead of silently losing the user's data.
    if (error) throw new Error(`supabase save failed: ${error.message}`);
  },

  // Non-destructive save: read the latest row, MERGE (union + tombstones), then
  // write conditioned on the version we read (updated_at). If another device
  // wrote in between, the conditional update matches nothing and we retry with
  // the fresher data — so no write ever clobbers another device's changes.
  async saveMerged(state: AppState): Promise<AppState> {
    const sb = getSupabase();
    const userId = getActiveUser();
    if (!sb || !userId) return state;

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await sb
        .from("app_state")
        .select("state, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`supabase read-for-merge failed: ${error.message}`);

      if (!data) {
        // No row yet — create it. If another device just created one, the
        // insert conflicts; loop to merge into it instead.
        const { error: insErr } = await sb
          .from("app_state")
          .insert({ user_id: userId, state, updated_at: new Date().toISOString() });
        if (!insErr) return state;
        continue;
      }

      const merged = mergeStates(coerceState(data.state), state);
      const { data: updated, error: updErr } = await sb
        .from("app_state")
        .update({ state: merged, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("updated_at", data.updated_at) // version check (compare-and-swap)
        .select("user_id");
      if (updErr) throw new Error(`supabase merged save failed: ${updErr.message}`);
      if (updated && updated.length > 0) return merged; // won the write
      // Version moved on (another device wrote) — retry with fresher data.
    }
    throw new Error("supabase save: too many concurrent writers, gave up");
  },
};
