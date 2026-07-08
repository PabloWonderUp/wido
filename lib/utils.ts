import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Task } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Palette assigned to clients, in order of creation. */
export const CLIENT_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#A855F7", // purple
  "#EC4899", // pink
] as const;

/** Pick the next color, cycling through the palette based on how many exist. */
export function nextClientColor(existingCount: number): string {
  return CLIENT_COLORS[existingCount % CLIENT_COLORS.length];
}

/** Timestamp -> value for <input type="datetime-local"> (local time). */
export function toDateTimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> timestamp (interpreted as local time). */
export function fromDateTimeLocal(value: string): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

/** Compact, human due-date label, e.g. "Today 14:30", "Jul 8, 09:00". */
export function formatDue(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (sameDay(d, now)) return `Today ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow ${time}`;
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${date}, ${time}`;
}

/** "overdue" | "soon" (<24h) | "later" for a due date, honoring completion. */
export function dueUrgency(
  ts: number,
  now = Date.now()
): "overdue" | "soon" | "later" {
  if (ts < now) return "overdue";
  if (ts - now < 24 * 60 * 60 * 1000) return "soon";
  return "later";
}

export type ReplyUrgency = "ok" | "warning" | "overdue";

/** Colors for the reply-deadline state: green → amber → red. */
export const REPLY_URGENCY_COLOR: Record<ReplyUrgency, string> = {
  ok: "#22C55E",
  warning: "#F59E0B",
  overdue: "#EF4444",
};

/**
 * Progress toward a reply deadline, based on the fraction of the window elapsed:
 * green for the first half, amber past the halfway point, red once overdue.
 */
export function replyUrgency(
  setAt: number,
  dueAt: number,
  now = Date.now()
): ReplyUrgency {
  if (now >= dueAt) return "overdue";
  const total = dueAt - setAt;
  if (total <= 0) return "overdue";
  return (now - setAt) / total < 0.5 ? "ok" : "warning";
}

/** Human remaining-time label for a reply deadline, e.g. "1h 20m left", "overdue 30m". */
export function formatReplyRemaining(dueAt: number, now = Date.now()): string {
  const diff = dueAt - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return diff >= 0 ? "<1m left" : "just overdue";
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `${label} left` : `overdue ${label}`;
}

/** Seconds -> "MM:SS" for the running timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Seconds -> compact tracked-time label, e.g. "1h 05m", "12m", "45s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

/** Seconds tracked for a client's tasks within a given month (year, 0-based month). */
export function clientMonthSeconds(
  tasks: Task[],
  clientId: string,
  year: number,
  monthIndex: number
): number {
  const start = new Date(year, monthIndex, 1).getTime();
  const end = new Date(year, monthIndex + 1, 1).getTime();
  let sum = 0;
  for (const t of tasks) {
    if (t.client !== clientId) continue;
    for (const e of t.timeEntries ?? []) {
      if (e.createdAt >= start && e.createdAt < end) sum += e.seconds || 0;
    }
  }
  return sum;
}

/** Seconds -> hours label, e.g. "12.5h". */
export function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** Amount -> money label, e.g. "$1,250". */
export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

/** Total tracked seconds for a task (sum of entries, with legacy fallback). */
export function taskTotalSeconds(task: Task): number {
  if (task.timeEntries && task.timeEntries.length > 0) {
    return task.timeEntries.reduce((sum, e) => sum + (e.seconds || 0), 0);
  }
  return task.timeSpent ?? 0;
}

/**
 * Read an image File and return a small square PNG data URL (cover-fit),
 * so client logos stay tiny in storage. Runs in the browser only.
 */
export async function fileToLogoDataUrl(
  file: File,
  size = 96
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/png");
}

/**
 * Read an image File and return a downscaled JPEG data URL (aspect preserved,
 * longest side capped). Keeps note images small enough for localStorage.
 */
export async function fileToImageDataUrl(
  file: File,
  maxSide = 1280,
  quality = 0.82
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Generate a reasonably unique id without extra deps. */
export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
