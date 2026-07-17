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

/**
 * Jittered exponential backoff between compare-and-swap retries. Without the
 * jitter, two devices retrying on the same cadence livelock forever — each one
 * bumps `updated_at` and invalidates the other's CAS. The random spread lets
 * one writer win a round while the other waits.
 */
function backoff(attempt: number): Promise<void> {
  const base = Math.min(1200, 50 * 2 ** attempt); // 50,100,200,…capped
  const ms = base + Math.floor(Math.random() * 150);
  return new Promise((r) => setTimeout(r, ms));
}

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

    const ATTEMPTS = 8;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
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
        await backoff(attempt);
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
      // Version moved on (another device wrote) — back off (jittered) so
      // concurrent writers desynchronize instead of livelocking, then retry.
      await backoff(attempt);
    }

    // Last resort: the CAS kept losing to concurrent writers. Do ONE
    // unconditional merged write so progress is GUARANTEED and this device's
    // edits/tombstones actually reach the cloud. Safe: it's a union+tombstone
    // merge of the latest cloud state, so it can't drop items or resurrect
    // deletions — the worst case is a rare concurrent edit needing one more sync.
    const { data: latest, error: readErr } = await sb
      .from("app_state")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(`supabase final read failed: ${readErr.message}`);
    const merged = latest ? mergeStates(coerceState(latest.state), state) : state;
    const { error: finalErr } = await sb.from("app_state").upsert(
      { user_id: userId, state: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (finalErr) throw new Error(`supabase final save failed: ${finalErr.message}`);
    console.warn("[wido] saveMerged: CAS exhausted → forced merged write");
    return merged;
  },
};
