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
  dueAt?: number; // optional due date + time (timestamp)
  timeSpent?: number; // legacy aggregate; migrated into timeEntries on load
  timeEntries?: TimeEntry[]; // logged time blocks (timer + manual)
  isProject?: boolean; // marked as a project (holds subtasks)
  subtasks?: SubTask[]; // checklist inside a project task
}

export interface Client {
  id: string;
  name: string;
  color: string;
  logo?: string; // optional logo as a data URL (or emoji)
}

export interface AppState {
  tasks: Task[];
  clients: Client[];
}

export type StatusFilter = "all" | TaskStatus;

export type SortMode = "manual" | "client" | "due";

export type ViewMode = "list" | "board";

export type BoardGroupBy = "status" | "client";
