import type { AppState, Client, Task } from "../types";
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
}

export const sqliteAdapter: StorageAdapter = {
  async load(): Promise<AppState> {
    const db = await getDb();

    const clients = (await db.select(
      "SELECT id, name, color FROM clients"
    )) as Client[];

    const taskRows = (await db.select(
      'SELECT id, title, details, client, completed, "order", createdAt, completedAt FROM tasks'
    )) as TaskRow[];

    const tasks: Task[] = taskRows.map((r) => ({
      id: r.id,
      title: r.title,
      details: r.details ?? undefined,
      client: r.client ?? undefined,
      completed: !!r.completed,
      order: r.order,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? undefined,
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
          "INSERT INTO clients (id, name, color) VALUES ($1, $2, $3)",
          [c.id, c.name, c.color]
        );
      }

      for (const t of state.tasks) {
        await db.execute(
          'INSERT INTO tasks (id, title, details, client, completed, "order", createdAt, completedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            t.id,
            t.title,
            t.details ?? null,
            t.client ?? null,
            t.completed ? 1 : 0,
            t.order,
            t.createdAt,
            t.completedAt ?? null,
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
