import type { AppState } from "./types";

/**
 * Compact, human-readable summary of a state for debug logging — counts plus
 * the task titles and tombstoned ids, so you can see WHAT is coming in and from
 * WHERE without dumping the whole blob into the console.
 */
export function summarizeState(s: AppState) {
  return {
    tasks: s.tasks.length,
    taskTitles: s.tasks.map((t) => t.title),
    clients: s.clients.length,
    notes: s.notes.length,
    tombstones: Object.keys(s.deletedAt ?? {}).length,
    tombstoneIds: Object.keys(s.deletedAt ?? {}),
  };
}
