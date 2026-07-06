"use client";

import * as React from "react";
import {
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  Plus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskInput } from "@/components/task-input";
import { TaskList } from "@/components/task-list";
import { BoardView } from "@/components/board-view";
import { StatusFilter } from "@/components/status-filter";
import { ClientFilter } from "@/components/client-filter";
import { ThemeToggle } from "@/components/theme-toggle";
import { DataMenu } from "@/components/data-menu";
import { AppNav } from "@/components/app-nav";
import { ClientManagerButton } from "@/components/client-manager";
import { AuthButton } from "@/components/auth-button";
import { useTasks } from "@/hooks/use-tasks";
import { useClients } from "@/hooks/use-clients";
import { statusOf } from "@/lib/status";
import type {
  BoardGroupBy,
  SortMode,
  StatusFilter as StatusFilterValue,
  ViewMode,
} from "@/lib/types";

const VIEW_PREFS_KEY = "task-tracker-view";
const SORT_LABELS: Record<SortMode, string> = {
  manual: "Manual",
  client: "Client",
  due: "Due date",
};

export default function Home() {
  const {
    tasks,
    hydrated,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    reorderTasks,
    setStatus: setTaskStatus,
  } = useTasks();
  const { clients, getClient } = useClients();

  const [status, setStatus] = React.useState<StatusFilterValue>("all");
  const [clientFilter, setClientFilter] = React.useState<string | null>(null);
  const [onlyReply, setOnlyReply] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ViewMode>("list");
  const [sort, setSort] = React.useState<SortMode>("manual");
  const [groupBy, setGroupBy] = React.useState<BoardGroupBy>("status");

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load / persist view preferences.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.view) setView(p.view);
        if (p.sort) setSort(p.sort);
        if (p.groupBy) setGroupBy(p.groupBy);
      }
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem(
        VIEW_PREFS_KEY,
        JSON.stringify({ view, sort, groupBy })
      );
    } catch {
      /* ignore */
    }
  }, [view, sort, groupBy]);

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
    if (status !== "all" && statusOf(t) !== status) return false;
    if (clientFilter && t.client !== clientFilter) return false;
    if (onlyReply && !t.needsReply) return false;
    return true;
  });

  const sortedTasks = React.useMemo(() => {
    if (sort === "manual") return visibleTasks;
    const arr = [...visibleTasks];
    if (sort === "client") {
      arr.sort((a, b) => {
        const an = getClient(a.client)?.name ?? "￿";
        const bn = getClient(b.client)?.name ?? "￿";
        return an.localeCompare(bn);
      });
    } else if (sort === "due") {
      arr.sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
    }
    return arr;
  }, [visibleTasks, sort, getClient]);

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
    <main
      className={cn(
        "mx-auto min-h-screen w-full px-4 py-10 sm:px-6",
        view === "board" ? "max-w-[110rem]" : "max-w-2xl"
      )}
    >
      <div className="mb-6">
        <AppNav />
      </div>

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wido</h1>
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
          <AuthButton />
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

      {/* View toggle + contextual control */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
          {(["list", "board"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "list" ? (
                <ListIcon className="h-3.5 w-3.5" />
              ) : (
                <LayoutGrid className="h-3.5 w-3.5" />
              )}
              {v === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>

        {view === "list" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort: {SORT_LABELS[sort]}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => setSort(s)}>
                  {SORT_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
            {(["status", "client"] as BoardGroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  groupBy === g
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {g === "status" ? "By status" : "By client"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters (list view only) */}
      {view === "list" && (
        <div className="mt-3 space-y-3">
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
      )}

      {/* Content */}
      <div className="mt-6">
        {!hydrated ? (
          <ListSkeleton />
        ) : view === "board" ? (
          <BoardView
            tasks={tasks}
            clients={clients}
            groupBy={groupBy}
            getClient={getClient}
            onToggle={toggleTask}
            onSetClient={(id, clientId) => updateTask(id, { client: clientId })}
            onSetStatus={setTaskStatus}
            onReorder={reorderTasks}
            onOpen={(id) => {
              setView("list");
              setExpandedId(id);
            }}
          />
        ) : sortedTasks.length === 0 ? (
          <EmptyState hasTasks={tasks.length > 0} />
        ) : (
          <TaskList
            tasks={sortedTasks}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            onToggle={toggleTask}
            onUpdate={updateTask}
            onDelete={(id) => {
              deleteTask(id);
              setExpandedId((cur) => (cur === id ? null : cur));
            }}
            onReorder={reorderTasks}
            dndDisabled={sort !== "manual"}
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
