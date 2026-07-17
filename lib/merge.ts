import type { AppState, TimeEntry } from "./types";

/**
 * Conflict-free-ish merge of two AppStates. Guiding rule: DON'T LOSE DATA.
 *  - Entities are UNIONED by id (never dropped just because one side lacks
 *    them), so a stale device can't wipe another device's items.
 *  - On a real conflict (same id both sides) the NEWER edit wins (updatedAt);
 *    ties / legacy items fall back to local.
 *  - Time entries are append-only, so they're unioned by id even across a
 *    conflict — logged time (tasks AND clients) is never lost.
 *  - Explicit deletes are honored via tombstones (deletedAt).
 */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function unionEntries(
  a?: TimeEntry[],
  b?: TimeEntry[]
): TimeEntry[] | undefined {
  if (!a?.length && !b?.length) return a ?? b;
  const byId = new Map<string, TimeEntry>();
  for (const e of a ?? []) byId.set(e.id, e);
  for (const e of b ?? []) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()];
}

type WithMeta = { id: string; updatedAt?: number; timeEntries?: TimeEntry[] };

// Resolve one id present on both sides: newer entity wins, but time entries are
// always unioned so none are lost regardless of which version wins.
function pickEntity<T extends WithMeta>(local: T, remote: T): T {
  const winner = (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0) ? local : remote;
  const other = winner === local ? remote : local;
  const entries = unionEntries(winner.timeEntries, other.timeEntries);
  return entries ? { ...winner, timeEntries: entries } : winner;
}

function mergeCollection<T extends WithMeta>(
  remote: T[],
  local: T[],
  deleted: Record<string, number>,
  pick: (local: T, remote: T) => T
): T[] {
  const byId = new Map<string, T>();
  for (const e of remote) byId.set(e.id, e);
  for (const e of local) {
    const existing = byId.get(e.id);
    byId.set(e.id, existing ? pick(e, existing) : e);
  }
  const out: T[] = [];
  for (const e of byId.values()) {
    if (deleted[e.id]) continue; // tombstoned — stays deleted
    out.push(e);
  }
  return out;
}

// Notes have no time entries — just newest-wins.
function pickNewer<T extends WithMeta>(local: T, remote: T): T {
  return (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0) ? local : remote;
}

export function mergeStates(remote: AppState, local: AppState, now = Date.now()): AppState {
  const deleted: Record<string, number> = { ...(remote.deletedAt ?? {}) };
  for (const [id, t] of Object.entries(local.deletedAt ?? {})) {
    deleted[id] = Math.max(deleted[id] ?? 0, t);
  }
  const cutoff = now - TOMBSTONE_TTL_MS;
  for (const id of Object.keys(deleted)) {
    if (deleted[id] < cutoff) delete deleted[id];
  }

  return {
    tasks: mergeCollection(remote.tasks, local.tasks, deleted, pickEntity),
    clients: mergeCollection(remote.clients, local.clients, deleted, pickEntity),
    notes: mergeCollection(remote.notes, local.notes, deleted, pickNewer),
    deletedAt: deleted,
  };
}
