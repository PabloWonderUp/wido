"use client";

import * as React from "react";
import { Check, Pause, Play, RotateCcw, Target, X } from "lucide-react";

import { cn, formatClock, formatDuration, taskTotalSeconds } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppNav } from "@/components/app-nav";
import { LottieBackground } from "@/components/lottie-background";
import { useTasks } from "@/hooks/use-tasks";

type Status = "idle" | "running" | "paused";

const PREFS_KEY = "task-tracker-timer";
const PRESETS = [15, 25, 45, 60];

export default function TimerPage() {
  const { tasks, hydrated, addTime } = useTasks();

  const [durationMin, setDurationMin] = React.useState(25);
  const [remaining, setRemaining] = React.useState(25 * 60); // seconds
  const [status, setStatus] = React.useState<Status>("idle");
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("25");

  const endRef = React.useRef<number>(0); // when remaining hits 0 (ms epoch)
  const segStartRef = React.useRef<number>(0); // remaining at segment start (s)

  // Load prefs once.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { durationMin?: number; taskId?: string };
        if (p.durationMin && p.durationMin > 0) {
          setDurationMin(p.durationMin);
          setRemaining(p.durationMin * 60);
          setEditValue(String(p.durationMin));
        }
        if (p.taskId) setTaskId(p.taskId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist prefs.
  React.useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ durationMin, taskId }));
    } catch {
      /* ignore */
    }
  }, [durationMin, taskId]);

  const flushSegment = React.useCallback(
    (current: number) => {
      if (taskId) {
        const elapsed = segStartRef.current - current;
        if (elapsed > 0) addTime(taskId, elapsed);
      }
      segStartRef.current = current;
    },
    [taskId, addTime]
  );

  // Countdown loop.
  React.useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      const secsLeft = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(secsLeft);
      if (secsLeft <= 0) {
        flushSegment(0);
        setStatus("idle");
        setRemaining(durationMin * 60);
      }
    }, 250);
    return () => clearInterval(id);
  }, [status, durationMin, flushSegment]);

  // Flush tracked time if the page unmounts mid-run.
  React.useEffect(() => {
    return () => {
      if (status === "running") flushSegment(remaining);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    endRef.current = Date.now() + remaining * 1000;
    segStartRef.current = remaining;
    setStatus("running");
  };

  const pause = () => {
    flushSegment(remaining);
    setStatus("paused");
  };

  const reset = () => {
    if (status === "running") flushSegment(remaining);
    setStatus("idle");
    setRemaining(durationMin * 60);
  };

  const applyDuration = (min: number) => {
    const clamped = Math.min(600, Math.max(1, Math.round(min)));
    setDurationMin(clamped);
    setEditValue(String(clamped));
    setRemaining(clamped * 60);
    setStatus("idle");
    endRef.current = 0;
  };

  const commitEdit = () => {
    const n = parseInt(editValue, 10);
    if (!Number.isNaN(n)) applyDuration(n);
    else setEditValue(String(durationMin));
    setEditing(false);
  };

  const running = status === "running";
  const selectedTask = tasks.find((t) => t.id === taskId) ?? null;
  const pendingTasks = tasks.filter((t) => !t.completed);

  // Progress ring (0..1 elapsed within current duration).
  const total = durationMin * 60;
  const progress = total > 0 ? 1 - remaining / total : 0;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-10">
      {/* Lottie background — only while running, behind everything */}
      {running && (
        <LottieBackground className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-20 [&>svg]:h-full [&>svg]:max-h-[80vh] [&>svg]:w-auto" />
      )}

      {/* Nav — hidden while running for a clean screen */}
      {!running && (
        <div className="z-10 mb-10">
          <AppNav />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        {/* "Working on" task selector */}
        {!running && (
          <TaskSelector
            hydrated={hydrated}
            tasks={pendingTasks}
            selected={selectedTask}
            onSelect={setTaskId}
          />
        )}

        {running && selectedTask && (
          <p className="text-sm font-medium text-muted-foreground">
            {selectedTask.title}
          </p>
        )}

        {/* Timer display (click to edit when not running) */}
        {editing ? (
          <div className="flex items-center gap-3">
            <input
              autoFocus
              value={editValue}
              inputMode="numeric"
              onChange={(e) =>
                setEditValue(e.target.value.replace(/[^0-9]/g, ""))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  setEditValue(String(durationMin));
                  setEditing(false);
                }
              }}
              onBlur={commitEdit}
              className="w-40 border-b-2 border-border bg-transparent text-center text-7xl font-bold tabular-nums outline-none focus:border-foreground"
            />
            <span className="text-2xl font-medium text-muted-foreground">
              min
            </span>
          </div>
        ) : (
          <button
            onClick={() => {
              if (!running) {
                setEditValue(String(durationMin));
                setEditing(true);
              }
            }}
            disabled={running}
            className={cn(
              "text-8xl font-bold tabular-nums tracking-tight transition-colors",
              !running && "hover:text-foreground/70",
              running ? "cursor-default" : "cursor-text"
            )}
          >
            {formatClock(remaining)}
          </button>
        )}

        {/* Presets (idle only) */}
        {status === "idle" && !editing && (
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => applyDuration(m)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  durationMin === m
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {m}m
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {status === "idle" && (
            <Button size="lg" className="gap-2" onClick={start}>
              <Play className="h-4 w-4" /> Start
            </Button>
          )}
          {status === "running" && (
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={pause}
            >
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          {status === "paused" && (
            <Button size="lg" className="gap-2" onClick={start}>
              <Play className="h-4 w-4" /> Resume
            </Button>
          )}
          {status !== "idle" && (
            <Button
              size="lg"
              variant="ghost"
              className="gap-2"
              onClick={reset}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
        </div>

        {/* Progress + tracked time */}
        {!running && (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            {status === "paused" && <span>{Math.round(progress * 100)}% done</span>}
            {selectedTask && taskTotalSeconds(selectedTask) > 0 && (
              <span>
                Tracked on this task:{" "}
                <span className="font-medium text-foreground">
                  {formatDuration(taskTotalSeconds(selectedTask))}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function TaskSelector({
  hydrated,
  tasks,
  selected,
  onSelect,
}: {
  hydrated: boolean;
  tasks: { id: string; title: string }[];
  selected: { id: string; title: string } | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex max-w-[80vw] items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">
            {selected ? selected.title : "Working on… (pick a task)"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-72 w-72 overflow-y-auto">
        {selected && (
          <>
            <DropdownMenuItem
              onSelect={() => onSelect(null)}
              className="text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> No task (free timer)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {!hydrated ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No pending tasks
          </div>
        ) : (
          tasks.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onSelect={() => onSelect(t.id)}
              className="justify-between"
            >
              <span className="truncate">{t.title}</span>
              {selected?.id === t.id && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
