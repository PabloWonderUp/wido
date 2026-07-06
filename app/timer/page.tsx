"use client";

import * as React from "react";
import { Check, Coffee, Pause, Play, RotateCcw, Target, X } from "lucide-react";

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
type Phase = "focus" | "break";

const PREFS_KEY = "task-tracker-timer";
const WORK_PRESETS = [15, 25, 45, 60];
const BREAK_PRESETS = [5, 10, 15];

const FOCUS_COLOR = "#3B82F6";
const BREAK_COLOR = "#22C55E";

export default function TimerPage() {
  const { tasks, hydrated, addTime } = useTasks();

  const [workMin, setWorkMin] = React.useState(25);
  const [breakMin, setBreakMin] = React.useState(5);
  const [phase, setPhase] = React.useState<Phase>("focus");
  const [remaining, setRemaining] = React.useState(25 * 60); // seconds
  const [status, setStatus] = React.useState<Status>("idle");
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("25");

  const endRef = React.useRef<number>(0); // when remaining hits 0 (ms epoch)
  const segStartRef = React.useRef<number>(0); // remaining at focus-segment start

  // Load prefs once.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as {
          workMin?: number;
          breakMin?: number;
          taskId?: string;
        };
        if (p.workMin && p.workMin > 0) {
          setWorkMin(p.workMin);
          setRemaining(p.workMin * 60);
          setEditValue(String(p.workMin));
        }
        if (p.breakMin && p.breakMin > 0) setBreakMin(p.breakMin);
        if (p.taskId) setTaskId(p.taskId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist prefs.
  React.useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ workMin, breakMin, taskId })
      );
    } catch {
      /* ignore */
    }
  }, [workMin, breakMin, taskId]);

  const flushSegment = React.useCallback(
    (current: number) => {
      // Only focus time counts toward a task.
      if (taskId && phase === "focus") {
        const elapsed = segStartRef.current - current;
        if (elapsed > 0) addTime(taskId, elapsed);
      }
      segStartRef.current = current;
    },
    [taskId, addTime, phase]
  );

  // Countdown loop — auto-cycles focus -> break -> focus …
  React.useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      const secsLeft = Math.max(
        0,
        Math.round((endRef.current - Date.now()) / 1000)
      );
      if (secsLeft > 0) {
        setRemaining(secsLeft);
        return;
      }
      // Phase finished — switch and keep running.
      if (phase === "focus") {
        flushSegment(0);
        const next = breakMin * 60;
        endRef.current = Date.now() + next * 1000;
        setPhase("break");
        setRemaining(next);
      } else {
        const next = workMin * 60;
        segStartRef.current = next;
        endRef.current = Date.now() + next * 1000;
        setPhase("focus");
        setRemaining(next);
      }
    }, 250);
    return () => clearInterval(id);
  }, [status, phase, workMin, breakMin, flushSegment]);

  // Flush tracked time if the page unmounts mid-run.
  React.useEffect(() => {
    return () => {
      if (status === "running") flushSegment(remaining);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    endRef.current = Date.now() + remaining * 1000;
    if (phase === "focus") segStartRef.current = remaining;
    setStatus("running");
  };

  const pause = () => {
    flushSegment(remaining);
    setStatus("paused");
  };

  const reset = () => {
    if (status === "running") flushSegment(remaining);
    setStatus("idle");
    setPhase("focus");
    setRemaining(workMin * 60);
    endRef.current = 0;
  };

  const applyWork = (min: number) => {
    const clamped = Math.min(600, Math.max(1, Math.round(min || 0)));
    setWorkMin(clamped);
    setEditValue(String(clamped));
    if (status === "idle" && phase === "focus") setRemaining(clamped * 60);
  };

  const applyBreak = (min: number) => {
    const clamped = Math.min(120, Math.max(1, Math.round(min || 0)));
    setBreakMin(clamped);
    if (status === "idle" && phase === "break") setRemaining(clamped * 60);
  };

  const commitEdit = () => {
    const n = parseInt(editValue, 10);
    if (!Number.isNaN(n)) {
      if (phase === "break") applyBreak(n);
      else applyWork(n);
    } else {
      setEditValue(String(phase === "break" ? breakMin : workMin));
    }
    setEditing(false);
  };

  const running = status === "running";
  const isBreak = phase === "break";
  const phaseColor = isBreak ? BREAK_COLOR : FOCUS_COLOR;
  const selectedTask = tasks.find((t) => t.id === taskId) ?? null;
  const pendingTasks = tasks.filter((t) => !t.completed);

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-10">
      {running && (
        <LottieBackground className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-20 [&>svg]:h-full [&>svg]:max-h-[80vh] [&>svg]:w-auto" />
      )}

      {!running && (
        <div className="z-10 mb-10">
          <AppNav />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        {!running && (
          <TaskSelector
            hydrated={hydrated}
            tasks={pendingTasks}
            selected={selectedTask}
            onSelect={setTaskId}
          />
        )}

        {running && selectedTask && !isBreak && (
          <p className="text-sm font-medium text-muted-foreground">
            {selectedTask.title}
          </p>
        )}

        {/* Phase label */}
        {status !== "idle" && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
            style={{ backgroundColor: `${phaseColor}22`, color: phaseColor }}
          >
            {isBreak ? (
              <Coffee className="h-3.5 w-3.5" />
            ) : (
              <Target className="h-3.5 w-3.5" />
            )}
            {isBreak ? "Break" : "Focus"}
          </span>
        )}

        {/* Timer display (tap to edit current phase when not running) */}
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
                if (e.key === "Escape") setEditing(false);
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
                setEditValue(String(isBreak ? breakMin : workMin));
                setEditing(true);
              }
            }}
            disabled={running}
            className={cn(
              "text-8xl font-bold tabular-nums tracking-tight transition-colors",
              !running && "cursor-text hover:opacity-70",
              running && "cursor-default"
            )}
          >
            {formatClock(remaining)}
          </button>
        )}

        {/* Duration settings (idle only) */}
        {status === "idle" && !editing && (
          <div className="flex flex-col items-center gap-3">
            <DurationRow
              label="Focus"
              color={FOCUS_COLOR}
              presets={WORK_PRESETS}
              value={workMin}
              onChange={applyWork}
            />
            <DurationRow
              label="Break"
              color={BREAK_COLOR}
              presets={BREAK_PRESETS}
              value={breakMin}
              onChange={applyBreak}
            />
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
            <Button size="lg" variant="secondary" className="gap-2" onClick={pause}>
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          {status === "paused" && (
            <Button size="lg" className="gap-2" onClick={start}>
              <Play className="h-4 w-4" /> Resume
            </Button>
          )}
          {status !== "idle" && (
            <Button size="lg" variant="ghost" className="gap-2" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
        </div>

        {!running && selectedTask && taskTotalSeconds(selectedTask) > 0 && (
          <p className="text-sm text-muted-foreground">
            Tracked on this task:{" "}
            <span className="font-medium text-foreground">
              {formatDuration(taskTotalSeconds(selectedTask))}
            </span>
          </p>
        )}
      </div>
    </main>
  );
}

function DurationRow({
  label,
  color,
  presets,
  value,
  onChange,
}: {
  label: string;
  color: string;
  presets: number[];
  value: number;
  onChange: (min: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span
        className="w-14 text-right text-xs font-semibold"
        style={{ color }}
      >
        {label}
      </span>
      {presets.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
          style={
            value === m
              ? { backgroundColor: color, color: "#fff" }
              : { backgroundColor: `${color}1f`, color }
          }
        >
          {m}m
        </button>
      ))}
      <input
        type="number"
        min={1}
        max={600}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={`${label} minutes`}
      />
    </div>
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
