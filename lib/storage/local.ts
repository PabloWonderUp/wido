import type { AppState } from "../types";
import { coerceState, type StorageAdapter } from "./index";

const STORAGE_KEY = "task-tracker-v1";

/** Browser localStorage backend (web + PWA). */
export const localAdapter: StorageAdapter = {
  async load(): Promise<AppState> {
    if (typeof window === "undefined") return { tasks: [], clients: [] };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { tasks: [], clients: [] };
      return coerceState(JSON.parse(raw));
    } catch {
      return { tasks: [], clients: [] };
    }
  },

  async save(state: AppState): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — fail silently for a personal app.
    }
  },
};
