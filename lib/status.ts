import type { Task, TaskStatus } from "./types";

/** Workflow states in board/column order. */
export const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  todo: { label: "To Do", color: "#94A3B8" }, // slate
  in_progress: { label: "In Progress", color: "#3B82F6" }, // blue
  blocked: { label: "Blocked", color: "#EF4444" }, // red
  done: { label: "Done", color: "#22C55E" }, // green
};

/** Resolve a task's status, falling back to the legacy `completed` boolean. */
export function statusOf(task: Task): TaskStatus {
  return task.status ?? (task.completed ? "done" : "todo");
}
