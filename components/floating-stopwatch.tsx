"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Pause, Play } from "lucide-react";

import { cn, formatStopwatch } from "@/lib/utils";
import { useStopwatch } from "@/hooks/stopwatch-store";

/**
 * Compact running stopwatch pinned to the corner, so you can keep an eye on it
 * (and pause/resume/lap) from any page. Hidden on the Tasks page ('/'), where
 * the full panel already lives, and whenever the stopwatch is idle.
 */
export function FloatingStopwatch() {
  const sw = useStopwatch();
  const pathname = usePathname();

  if (!sw.hasTime || pathname === "/") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pl-2 pr-1.5 shadow-lg backdrop-blur">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          sw.running ? "animate-pulse bg-sky-500" : "bg-muted-foreground"
        )}
      />
      <Link
        href="/"
        className="font-mono text-sm font-semibold tabular-nums hover:underline"
        title="Open timer"
      >
        {formatStopwatch(sw.elapsedMs)}
      </Link>
      <button
        onClick={sw.lap}
        disabled={!sw.running}
        aria-label="Lap"
        title="Lap"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={sw.toggle}
        aria-label={sw.running ? "Pause" : "Resume"}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors",
          sw.running
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-sky-500 hover:bg-sky-600"
        )}
      >
        {sw.running ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
