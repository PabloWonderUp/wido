export interface Task {
  id: string;
  title: string;
  details?: string;
  client?: string; // Client id
  completed: boolean;
  order: number;
  createdAt: number;
  completedAt?: number; // set when marked done — powers the "done today" count
}

export interface Client {
  id: string;
  name: string;
  color: string;
}

export interface AppState {
  tasks: Task[];
  clients: Client[];
}

export type StatusFilter = "all" | "pending" | "done";
