export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TimeEntry {
  id: string;
  seconds: number;
  label?: string;
  createdAt: number;
  manual?: boolean; // added by hand vs tracked by the timer
}

export interface Task {
  id: string;
  title: string;
  details?: string;
  client?: string; // Client id
  completed: boolean; // kept in sync with status === "done"
  status?: TaskStatus; // authoritative workflow state
  order: number;
  createdAt: number;
  completedAt?: number; // set when marked done — powers the "done today" count
  needsReply?: boolean; // flag: I owe someone a message / a reply
  replyTo?: string; // who I need to message/reply
  replyNote?: string; // what I need to say / context
  replyDueAt?: number; // optional deadline to reply (timestamp) — drives green→yellow→red
  replySetAt?: number; // when the reply deadline was set — needed to compute progress
  dueAt?: number; // optional due date + time (timestamp)
  timeSpent?: number; // legacy aggregate; migrated into timeEntries on load
  timeEntries?: TimeEntry[]; // logged time blocks (timer + manual)
  isProject?: boolean; // marked as a project (holds subtasks)
  subtasks?: SubTask[]; // checklist inside a project task
  archived?: boolean; // hidden from the main views; kept for reference
  priorityRank?: number; // 1..5 slot in the daily "Top 5" focus list
}

export interface Note {
  id: string;
  title?: string;
  content: string; // rich text as HTML (from the editor)
  taskId?: string; // linked task; if absent it's a personal note
  createdAt: number;
  updatedAt: number;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  logo?: string; // optional logo as a data URL (or emoji)
  hourTracking?: boolean; // freelance mode: track monthly hours for this client
  monthlyHoursTarget?: number; // optional monthly hours goal
  hourlyRate?: number; // optional $/hour to compute earnings
  timeEntries?: TimeEntry[]; // hours logged directly to the client (not via a task)
}

export interface AppState {
  tasks: Task[];
  clients: Client[];
  notes: Note[];
  /**
   * Tombstones: id -> deletion time (ms). Lets deletes survive a merge instead
   * of a deleted item reappearing from another device's copy. Pruned after a
   * while (see lib/merge.ts). Keyed by task/client/note id (all unique).
   */
  deletedAt?: Record<string, number>;
}

export type StatusFilter = "all" | TaskStatus;

export type SortMode = "manual" | "client" | "due";

export type ViewMode = "list" | "board" | "projects";

export type BoardGroupBy = "status" | "client";
