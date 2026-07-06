"use client";

import { loadState, saveState } from "@/lib/storage";
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

let state: AppState = { tasks: [], clients: [] };
let hydrated = false;
let hydrating = false;
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
  try {
    state = migrate(await loadState());
  } finally {
    hydrated = true;
    hydrating = false;
    emit();
  }
}

/** Replace state via an updater; update the UI immediately, persist async. */
export function setState(updater: (prev: AppState) => AppState) {
  state = updater(state);
  emit();
  void saveState(state);
}

/** Replace the whole state (used by import/restore). */
export function replaceState(next: AppState) {
  state = next;
  emit();
  void saveState(state);
}
