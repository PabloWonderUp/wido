"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  Check,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Tag,
  Timer as TimerIcon,
  User,
} from "lucide-react";

import { cn, formatStopwatch } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LottieBackground } from "@/components/lottie-background";
import { useStopwatch } from "@/hooks/stopwatch-store";
import { useTasks } from "@/hooks/use-tasks";
import { useClients } from "@/hooks/use-clients";

export function StopwatchPanel() {
  const sw = useStopwatch();
  const { tasks, getTask } = useTasks();
  const { clients, getClient } = useClients();

  const activeTasks = tasks.filter((t) => !t.archived && !t.completed);

  const goalReached = sw.goalMs != null && sw.elapsedMs >= sw.goalMs;

  // Goal editing, in hours or minutes, kept in sync with the store.
  const [goalUnit, setGoalUnit] = React.useState<"h" | "min">(
    sw.goalMs != null && sw.goalMs < 3_600_000 ? "min" : "h"
  );
  const unitMs = goalUnit === "min" ? 60_000 : 3_600_000;
  const [goalDraft, setGoalDraft] = React.useState(
    sw.goalMs ? String(+(sw.goalMs / unitMs).toFixed(2)) : ""
  );
  React.useEffect(() => {
    const ms = goalUnit === "min" ? 60_000 : 3_600_000;
    setGoalDraft(sw.goalMs ? String(+(sw.goalMs / ms).toFixed(2)) : "");
  }, [sw.goalMs, goalUnit]);
  const commitGoal = () => {
    const v = parseFloat(goalDraft.replace(",", "."));
    sw.setGoal(!Number.isNaN(v) && v > 0 ? Math.round(v * unitMs) : null);
  };
  const toggleUnit = () => {
    commitGoal(); // persist current draft in the current unit first
    setGoalUnit((u) => (u === "h" ? "min" : "h"));
  };

  const attachLabel = (() => {
    if (!sw.attach) return null;
    return sw.attach.type === "task"
      ? getTask(sw.attach.id)?.title
      : getClient(sw.attach.id)?.name;
  })();

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
      {sw.running && (
        <LottieBackground className="pointer-events-none absolute inset-0 opacity-[0.08]" />
      )}

      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <TimerIcon className="h-4 w-4 text-sky-500" />
            Timer
          </span>

          {/* Attach target */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex max-w-[9rem] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  attachLabel
                    ? "bg-sky-500/15 text-sky-500 hover:bg-sky-500/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title={attachLabel ?? "Log to a task or client"}
              >
                {sw.attach?.type === "client" ? (
                  <User className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{attachLabel ?? "Log to…"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-72 w-56 overflow-y-auto"
            >
              <DropdownMenuItem
                onSelect={() => sw.setAttach(null)}
                className="justify-between"
              >
                No target (just time)
                {!sw.attach && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>

              {clients.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Clients
                  </div>
                  {clients.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={() =>
                        sw.setAttach({ type: "client", id: c.id })
                      }
                      className="justify-between gap-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="truncate">{c.name}</span>
                      </span>
                      {sw.attach?.type === "client" &&
                        sw.attach.id === c.id && (
                          <Check className="h-3.5 w-3.5 shrink-0" />
                        )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {activeTasks.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Tasks
                  </div>
                  {activeTasks.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => sw.setAttach({ type: "task", id: t.id })}
                      className="justify-between gap-2"
                    >
                      <span className="truncate">{t.title}</span>
                      {sw.attach?.type === "task" && sw.attach.id === t.id && (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Elapsed */}
        <div className="py-2 text-center">
          <span
            className={cn(
              "font-mono text-4xl font-bold tabular-nums",
              goalReached && "text-green-500"
            )}
          >
            {formatStopwatch(sw.elapsedMs)}
          </span>
          {sw.goalMs != null &&
            (goalReached ? (
              <div className="mt-0.5 text-xs font-medium text-green-500">
                🎉 Goal reached
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatStopwatch(sw.goalMs - sw.elapsedMs)} left
              </div>
            ))}
        </div>

        {/* Goal + alarm */}
        <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>Goal</span>
          <input
            type="number"
            min={0}
            step={0.25}
            inputMode="decimal"
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onBlur={commitGoal}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="—"
            className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-center text-sm tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            onClick={toggleUnit}
            title="Switch hours / minutes"
            className="rounded-md px-1.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {goalUnit}
          </button>
          <button
            onClick={sw.toggleAlarm}
            aria-pressed={sw.alarmEnabled}
            title={sw.alarmEnabled ? "Alarm on" : "Alarm off"}
            className={cn(
              "rounded p-1 transition-colors",
              sw.alarmEnabled
                ? "text-sky-500 hover:bg-sky-500/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {sw.alarmEnabled ? (
              <Bell className="h-3.5 w-3.5" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={sw.toggle}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm transition-colors",
              sw.running
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-sky-500 hover:bg-sky-600"
            )}
            aria-label={sw.running ? "Pause" : "Start"}
          >
            {sw.running ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={sw.lap}
            disabled={!sw.running}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent disabled:opacity-40"
            aria-label="Lap"
            title="Lap"
          >
            <Flag className="h-4 w-4" />
          </button>

          {sw.hasTime && !sw.running && (
            <>
              <button
                onClick={() => sw.saveAndReset()}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-green-500 px-3 text-sm font-medium text-white transition-colors hover:bg-green-600"
                title={
                  sw.attach
                    ? "Save time to the target and reset"
                    : "Reset (nothing to log — no target)"
                }
              >
                <Check className="h-4 w-4" />
                {sw.attach ? "Save" : "Done"}
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Discard this timer?")) sw.reset();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Reset"
                title="Discard"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Laps */}
        {sw.laps.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs tabular-nums">
            {sw.laps.map((lap, i) => {
              const prev = i === 0 ? 0 : sw.laps[i - 1];
              return (
                <li
                  key={i}
                  className="flex items-center justify-between text-muted-foreground"
                >
                  <span>Lap {i + 1}</span>
                  <span className="text-foreground">+{formatStopwatch(lap - prev)}</span>
                  <span>{formatStopwatch(lap)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
