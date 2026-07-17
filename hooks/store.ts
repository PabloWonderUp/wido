"use client";

import {
  loadState,
  saveState,
  saveStateMerged,
  currentBackendKey,
} from "@/lib/storage";
import { localAdapter } from "@/lib/storage/local";
import { mergeStates } from "@/lib/merge";
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

/**
 * Serialized, non-destructive persistence. Only one save runs at a time; edits
 * made during a save re-trigger it afterwards. The cloud save reads-merges-
 * writes (see saveStateMerged), so it never clobbers another device — and we
 * adopt the merged result so this device also picks up others' changes.
 */
let flushing = false;
let dirty = false;

async function flush() {
  if (currentBackendKey() !== boundKey) return; // not bound — never clobber
  if (flushing) {
    dirty = true; // an edit landed mid-save; run again after
    return;
  }
  flushing = true;
  dirty = false;
  const snapshot = state;
  try {
    const merged = await saveStateMerged(snapshot);
    // Only adopt the merged result if no newer edit happened while saving, so
    // we surface other devices' items without dropping a fresh local edit.
    if (state === snapshot && merged) {
      const next = migrate(merged);
      if (JSON.stringify(next) !== JSON.stringify(state)) {
        state = next;
        emit();
      }
    }
  } catch (err) {
    console.error("[wido] save failed", err);
    dirty = true; // retry
  } finally {
    flushing = false;
    if (dirty) setTimeout(() => void flush(), 800);
  }
}

function persist() {
  void flush();
}

/** Replace state via an updater; update the UI immediately, persist async. */
export function setState(updater: (prev: AppState) => AppState) {
  state = updater(state);
  emit();
  persist();
}

/**
 * Overwrite the local (localStorage) cache with the current state. Called after
 * a destructive clear so no stale local copy can resurrect deleted data via the
 * first-login seed or offline mode. Safe on all targets (writes localStorage).
 */
export function syncLocalCache() {
  void localAdapter.save(state).catch((err) =>
    console.error("[wido] local cache sync failed", err)
  );
}

/**
 * Replace the whole state (import / restore). This is an intentional overwrite,
 * so it bypasses the merge and writes directly to the backend.
 */
export function replaceState(next: AppState) {
  state = next;
  emit();
  if (currentBackendKey() !== boundKey) return;
  void saveState(next).catch((err) =>
    console.error("[wido] restore/overwrite failed", err)
  );
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
  // Merge (don't replace): union in the remote changes + tombstones while
  // keeping any local edits not yet flushed, so nothing is dropped either way.
  const migrated = migrate(mergeStates(next, state));
  if (JSON.stringify(migrated) === JSON.stringify(state)) return; // no change
  state = migrated;
  hydrated = true;
  emit();
}
