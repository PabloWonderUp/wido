"use client";

import { loadState, saveState, currentBackendKey } from "@/lib/storage";
import { makeId } from "@/lib/utils";
import type { AppState } from "@/lib/types";

/** One-time: fold a legacy `timeSpent` aggregate into a time entry. */
function migrate(state: AppState): AppState {
  return {
    ...state,
    tasks: state.tasks.map((t) => {
      let next = t;
      if (t.timeSpent && t.timeSpent > 0 && !(t.timeEntries?.length)) {
        next = {
          ...next,
          timeSpent: undefined,
          timeEntries: [
            {
              id: makeId(),
              seconds: t.timeSpent,
              label: "Tracked",
              createdAt: t.createdAt,
            },
          ],
        };
      }
      if (!next.status) {
        next = { ...next, status: next.completed ? "done" : "todo" };
      }
      return next;
    }),
  };
}

/**
 * A tiny shared store so `useTasks` and `useClients` operate on the same
 * state and persist it consistently through the active storage adapter
 * (localStorage on web, SQLite on desktop). Kept dependency-free on purpose.
 */

let state: AppState = { tasks: [], clients: [], notes: [] };
let hydrated = false;
let hydrating = false;
/**
 * The backend key the current in-memory `state` was successfully loaded from.
 * Writes only persist when this matches the *active* backend — so a state read
 * from `local` (or from nothing, pre-auth) can never be written over the cloud.
 */
let boundKey: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): AppState {
  return state;
}

export function isHydrated(): boolean {
  return hydrated;
}

/** Load from the storage adapter once, on the client. */
export async function hydrate() {
  if (hydrated || hydrating) return;
  hydrating = true;
  const key = currentBackendKey();
  try {
    state = migrate(await loadState());
    boundKey = key; // safe to persist to this backend now
    hydrated = true;
  } catch (err) {
    // Load failed — leave state untouched and stay UNBOUND so nothing gets
    // written back over a backend we couldn't read. A later rehydrate/reload
    // will reconcile.
    console.error("[wido] hydrate failed", err);
  } finally {
    hydrating = false;
    emit();
  }
}

/**
 * Force a reload from the current adapter (e.g. after login/logout switches
 * it). Returns whether the reload succeeded; only on success does the store
 * bind to (and become writable against) that backend.
 */
export async function rehydrate(): Promise<boolean> {
  const key = currentBackendKey();
  try {
    const next = migrate(await loadState());
    state = next;
    boundKey = key;
    hydrated = true;
    emit();
    return true;
  } catch (err) {
    // Couldn't load this backend (e.g. cloud unreachable / token issue). Do
    // NOT bind and do NOT clobber — keep showing whatever we already have.
    console.error("[wido] rehydrate failed", err);
    return false;
  }
}

/** Persist to the active backend, but only if the store is bound to it. */
function persist() {
  if (currentBackendKey() !== boundKey) {
    // Backend switched (e.g. mid-login) but we haven't loaded from it yet —
    // skip the write so we never overwrite it with the wrong data.
    return;
  }
  const snapshot = state;
  void saveState(snapshot).catch(async (err) => {
    // Retry once for transient blips before giving up loudly.
    console.error("[wido] save failed, retrying once", err);
    try {
      if (currentBackendKey() === boundKey && state === snapshot) {
        await saveState(snapshot);
      }
    } catch (err2) {
      console.error("[wido] save failed after retry", err2);
    }
  });
}

/** Replace state via an updater; update the UI immediately, persist async. */
export function setState(updater: (prev: AppState) => AppState) {
  state = updater(state);
  emit();
  persist();
}

/** Replace the whole state (used by import/restore). */
export function replaceState(next: AppState) {
  state = next;
  emit();
  persist();
}

/**
 * Apply state pushed from elsewhere (another device via Supabase Realtime, or a
 * focus/online reload). Updates the UI but NEVER persists — it already is the
 * source of truth in the cloud, so writing it back would just echo. Guarded so
 * cloud data can't bleed into local mode, and skips no-op echoes of our own
 * writes (Realtime also delivers the changes we made ourselves).
 */
export function applyRemoteState(next: AppState) {
  if (currentBackendKey() !== boundKey) return; // not bound to this backend
  const migrated = migrate(next);
  if (JSON.stringify(migrated) === JSON.stringify(state)) return; // no change
  state = migrated;
  hydrated = true;
  emit();
}
