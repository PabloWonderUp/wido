import type { AppState } from "./types";

/**
 * Conflict-free-ish merge of two AppStates. The guiding rule is DON'T LOSE
 * DATA: entities are UNIONED by id (never dropped just because one side lacks
 * them), so a stale device can't wipe another device's items. The only removals
 * are explicit tombstones (deletedAt). On a genuine conflict (same id on both
 * sides) `local` wins — which, with live sync keeping local fresh, is current.
 */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function mergeCollection<T extends { id: string }>(
  remote: T[],
  local: T[],
  deleted: Record<string, number>
): T[] {
  const byId = new Map<string, T>();
  for (const e of remote) byId.set(e.id, e);
  for (const e of local) byId.set(e.id, e); // local wins on conflict
  const out: T[] = [];
  for (const e of byId.values()) {
    if (deleted[e.id]) continue; // tombstoned — stays deleted
    out.push(e);
  }
  return out;
}

export function mergeStates(remote: AppState, local: AppState, now = Date.now()): AppState {
  // Union tombstones, keeping the latest deletion time; prune expired ones.
  const deleted: Record<string, number> = { ...(remote.deletedAt ?? {}) };
  for (const [id, t] of Object.entries(local.deletedAt ?? {})) {
    deleted[id] = Math.max(deleted[id] ?? 0, t);
  }
  const cutoff = now - TOMBSTONE_TTL_MS;
  for (const id of Object.keys(deleted)) {
    if (deleted[id] < cutoff) delete deleted[id];
  }

  return {
    tasks: mergeCollection(remote.tasks, local.tasks, deleted),
    clients: mergeCollection(remote.clients, local.clients, deleted),
    notes: mergeCollection(remote.notes, local.notes, deleted),
    deletedAt: deleted,
  };
}
