import type { AppState, Client, Task, TimeEntry } from "../types";
import type { StorageAdapter } from "./index";

/**
 * SQLite backend for the Tauri desktop build. Data lives in a real `.db` file
 * on disk (AppConfig dir), so it survives app restarts/updates and can be
 * backed up as a file. The schema is created via Rust migrations
 * (see src-tauri/src/lib.rs); this adapter just reads/writes rows.
 *
 * The import is dynamic so the web/PWA bundle never loads the Tauri plugin.
 */

const DB_URL = "sqlite:tasks.db";

// Loaded lazily; `any` avoids a hard dependency on the plugin types in web builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<any> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = import("@tauri-apps/plugin-sql").then((m) =>
      m.default.load(DB_URL)
    );
  }
  return dbPromise;
}

interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  client: string | null;
  completed: number;
  order: number;
  createdAt: number;
  completedAt: number | null;
  needsReply: number;
  replyTo: string | null;
  replyNote: string | null;
  dueAt: number | null;
  timeSpent: number;
  timeEntries: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  color: string;
  logo: string | null;
}

export const sqliteAdapter: StorageAdapter = {
  async load(): Promise<AppState> {
    const db = await getDb();

    const clientRows = (await db.select(
      "SELECT id, name, color, logo FROM clients"
    )) as ClientRow[];
    const clients: Client[] = clientRows.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      logo: c.logo ?? undefined,
    }));

    const taskRows = (await db.select(
      'SELECT id, title, details, client, completed, "order", createdAt, completedAt, needsReply, replyTo, replyNote, dueAt, timeSpent, timeEntries FROM tasks'
    )) as TaskRow[];

    const parseEntries = (raw: string | null): TimeEntry[] | undefined => {
      if (!raw) return undefined;
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    };

    const tasks: Task[] = taskRows.map((r) => ({
      id: r.id,
      title: r.title,
      details: r.details ?? undefined,
      client: r.client ?? undefined,
      completed: !!r.completed,
      order: r.order,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? undefined,
      needsReply: !!r.needsReply,
      replyTo: r.replyTo ?? undefined,
      replyNote: r.replyNote ?? undefined,
      dueAt: r.dueAt ?? undefined,
      timeSpent: r.timeSpent ?? 0,
      timeEntries: parseEntries(r.timeEntries),
    }));

    return { tasks, clients };
  },

  async save(state: AppState): Promise<void> {
    const db = await getDb();

    // Full replace inside a transaction — simple and safe at personal scale.
    await db.execute("BEGIN TRANSACTION");
    try {
      await db.execute("DELETE FROM tasks");
      await db.execute("DELETE FROM clients");

      for (const c of state.clients) {
        await db.execute(
          "INSERT INTO clients (id, name, color, logo) VALUES ($1, $2, $3, $4)",
          [c.id, c.name, c.color, c.logo ?? null]
        );
      }

      for (const t of state.tasks) {
        await db.execute(
          'INSERT INTO tasks (id, title, details, client, completed, "order", createdAt, completedAt, needsReply, replyTo, replyNote, dueAt, timeSpent, timeEntries) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
          [
            t.id,
            t.title,
            t.details ?? null,
            t.client ?? null,
            t.completed ? 1 : 0,
            t.order,
            t.createdAt,
            t.completedAt ?? null,
            t.needsReply ? 1 : 0,
            t.replyTo ?? null,
            t.replyNote ?? null,
            t.dueAt ?? null,
            t.timeSpent ?? 0,
            t.timeEntries ? JSON.stringify(t.timeEntries) : null,
          ]
        );
      }

      await db.execute("COMMIT");
    } catch (e) {
      await db.execute("ROLLBACK");
      throw e;
    }
  },
};
