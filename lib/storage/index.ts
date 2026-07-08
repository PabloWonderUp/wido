import type { AppState } from "../types";
import { localAdapter } from "./local";
import { sqliteAdapter } from "./sqlite";
import { supabaseAdapter } from "./supabase";
import { getActiveUser } from "./active-user";

/**
 * Storage abstraction. The live app talks only to `loadState`/`saveState`;
 * the concrete backend is chosen at runtime:
 *   - Desktop (Tauri)  -> SQLite file on disk (durable, backup-able)
 *   - Web / PWA        -> localStorage
 *
 * Both persist the same JSON-shaped `AppState`, so data stays portable and a
 * future move to a remote DB (Supabase) only means adding another adapter.
 */
export interface StorageAdapter {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
}

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

function getAdapter(): StorageAdapter {
  if (getActiveUser()) return supabaseAdapter; // signed in -> cloud
  return isTauri() ? sqliteAdapter : localAdapter;
}

export function loadState(): Promise<AppState> {
  return getAdapter().load();
}

export function saveState(state: AppState): Promise<void> {
  return getAdapter().save(state);
}

/** Normalize an unknown parsed object into a valid AppState. */
export function coerceState(input: unknown): AppState {
  const obj = (input ?? {}) as Partial<AppState>;
  return {
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    clients: Array.isArray(obj.clients) ? obj.clients : [],
    notes: Array.isArray(obj.notes) ? obj.notes : [],
  };
}

const EXPORT_VERSION = 1;

/** Serialize state to a pretty JSON string for backup/export. */
export function exportToJson(state: AppState): string {
  return JSON.stringify(
    { version: EXPORT_VERSION, exportedAt: Date.now(), ...state },
    null,
    2
  );
}

/** Parse a backup JSON string back into a validated AppState. */
export function importFromJson(raw: string): AppState {
  return coerceState(JSON.parse(raw));
}
