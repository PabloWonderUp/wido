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
  completed: boolean;
  order: number;
  createdAt: number;
  completedAt?: number; // set when marked done — powers the "done today" count
  needsReply?: boolean; // flag: I owe someone a message / a reply
  replyTo?: string; // who I need to message/reply
  replyNote?: string; // what I need to say / context
  dueAt?: number; // optional due date + time (timestamp)
  timeSpent?: number; // legacy aggregate; migrated into timeEntries on load
  timeEntries?: TimeEntry[]; // logged time blocks (timer + manual)
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

export type StatusFilter = "all" | "pending" | "done";
