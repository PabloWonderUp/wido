import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

/** Generate a reasonably unique id without extra deps. */
export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
