"use client";

import * as React from "react";
import { MessageSquare, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskInput } from "@/components/task-input";
import { TaskList } from "@/components/task-list";
import { StatusFilter } from "@/components/status-filter";
import { ClientFilter } from "@/components/client-filter";
import { ThemeToggle } from "@/components/theme-toggle";
import { DataMenu } from "@/components/data-menu";
import { AppNav } from "@/components/app-nav";
import { ClientManagerButton } from "@/components/client-manager";
import { useTasks } from "@/hooks/use-tasks";
import { useClients } from "@/hooks/use-clients";
import type { StatusFilter as StatusFilterValue } from "@/lib/types";

export default function Home() {
  const {
    tasks,
    hydrated,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    reorderTasks,
  } = useTasks();
  const { clients } = useClients();

  const [status, setStatus] = React.useState<StatusFilterValue>("all");
  const [clientFilter, setClientFilter] = React.useState<string | null>(null);
  const [onlyReply, setOnlyReply] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: "n" focuses the input, Escape closes an expanded task.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "n" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && !typing) {
        setExpandedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleTasks = tasks.filter((t) => {
    if (status === "pending" && t.completed) return false;
    if (status === "done" && !t.completed) return false;
    if (clientFilter && t.client !== clientFilter) return false;
    if (onlyReply && !t.needsReply) return false;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const doneTodayCount = tasks.filter(
    (t) => t.completed && t.completedAt && t.completedAt >= startOfToday
  ).length;
  const toReplyCount = tasks.filter(
    (t) => t.needsReply && !t.completed
  ).length;

  const toggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <AppNav />
      </div>

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingCount} pending · {doneTodayCount} done today
            {toReplyCount > 0 && (
              <> · {toReplyCount} to reply</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ClientManagerButton />
          <DataMenu />
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => inputRef.current?.focus()}
          >
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>
      </header>

      {/* New task input */}
      <div className="mt-6">
        <TaskInput onAdd={addTask} inputRef={inputRef} />
      </div>

      {/* Filters */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusFilter value={status} onChange={setStatus} />
          <button
            onClick={() => setOnlyReply((v) => !v)}
            aria-pressed={onlyReply}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
              onlyReply
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            To reply
            {toReplyCount > 0 && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 text-xs",
                  onlyReply ? "bg-white/25" : "bg-background/60"
                )}
              >
                {toReplyCount}
              </span>
            )}
          </button>
        </div>
        <ClientFilter
          clients={clients}
          value={clientFilter}
          onChange={setClientFilter}
        />
      </div>

      {/* List */}
      <div className="mt-6">
        {!hydrated ? (
          <ListSkeleton />
        ) : visibleTasks.length === 0 ? (
          <EmptyState hasTasks={tasks.length > 0} />
        ) : (
          <TaskList
            tasks={visibleTasks}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            onToggle={toggleTask}
            onUpdate={updateTask}
            onDelete={(id) => {
              deleteTask(id);
              setExpandedId((cur) => (cur === id ? null : cur));
            }}
            onReorder={reorderTasks}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState({ hasTasks }: { hasTasks: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center">
      <p className="text-sm text-muted-foreground">
        {hasTasks
          ? "Nothing here with these filters."
          : "No tasks yet. Add one above to get started."}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[52px] animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
