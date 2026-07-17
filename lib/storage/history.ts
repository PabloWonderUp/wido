import { getSupabase } from "@/lib/supabase";
import type { AppState } from "../types";
import { coerceState } from "./index";
import { getActiveUser } from "./active-user";

/**
 * Cloud-only version history. Every overwrite of a user's app_state archives
 * the previous version server-side (see supabase/app_state_history.sql); this
 * module reads those versions back so the user can recover from an accidental
 * wipe. No-ops (empty) when not signed in.
 */
export interface HistoryVersion {
  id: number;
  replacedAt: number; // ms epoch — when this version was replaced
  taskCount: number;
  clientCount: number;
  noteCount: number;
}

/** Whether version history is available (i.e. we're on the cloud backend). */
export function historyAvailable(): boolean {
  return !!getSupabase() && !!getActiveUser();
}

/** Newest-first list of archived versions for the signed-in user. */
export async function listHistory(): Promise<HistoryVersion[]> {
  const sb = getSupabase();
  if (!sb || !getActiveUser()) return [];
  const { data, error } = await sb.rpc("list_app_state_history");
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    replacedAt: new Date(r.replaced_at as string).getTime(),
    taskCount: Number(r.task_count ?? 0),
    clientCount: Number(r.client_count ?? 0),
    noteCount: Number(r.note_count ?? 0),
  }));
}

/** Fetch the full AppState of one archived version, or null if unavailable. */
export async function fetchHistoryState(id: number): Promise<AppState | null> {
  const sb = getSupabase();
  if (!sb || !getActiveUser()) return null;
  const { data, error } = await sb
    .from("app_state_history")
    .select("state")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return coerceState(data.state);
}
