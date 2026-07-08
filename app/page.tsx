"use client";

import * as React from "react";
import {
  Archive,
  ArrowUpDown,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  Plus,
  Star,
  StickyNote,
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
import { BoardSwimlanes } from "@/components/board-swimlanes";
import { ProjectsView } from "@/components/projects-view";
import { ReplyPanel } from "@/components/reply-panel";
import { StatusFilter } from "@/components/status-filter";
import { ClientFilter } from "@/components/client-filter";
import { ThemeToggle } from "@/components/theme-toggle";
import { DataMenu } from "@/components/data-menu";
import { AppNav } from "@/components/app-nav";
import { ClientManagerButton } from "@/components/client-manager";
import { useNoteDialog } from "@/components/note-dialog";
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
    toggleArchived,
    togglePriority,
    reorderPriorities,
    reorderTasks,
    setStatus: setTaskStatus,
    toggleSubtask,
  } = useTasks();
  const { clients, getClient } = useClients();
  const { open: openNote } = useNoteDialog();

  const [status, setStatus] = React.useState<StatusFilterValue>("all");
  const [clientFilter, setClientFilter] = React.useState<string | null>(null);
  const [onlyReply, setOnlyReply] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
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

  // Everything not archived — powers counts, board, projects and the reply panel.
  const activeTasks = tasks.filter((t) => !t.archived);
  const archivedCount = tasks.length - activeTasks.length;

  const visibleTasks = tasks.filter((t) => {
    if (!!t.archived !== showArchived) return false;
    if (status !== "all" && statusOf(t) !== status) return false;
    if (clientFilter && t.client !== clientFilter) return false;
    if (onlyReply && !t.needsReply) return false;
    return true;
  });

  const sortedTasks = React.useMemo(() => {
    let arr = visibleTasks;
    if (sort !== "manual") {
      arr = [...visibleTasks];
      if (sort === "client") {
        arr.sort((a, b) => {
          const an = getClient(a.client)?.name ?? "￿";
          const bn = getClient(b.client)?.name ?? "￿";
          return an.localeCompare(bn);
        });
      } else if (sort === "due") {
        arr.sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
      }
    }
    // Checked tasks always sink to the bottom (stable — doesn't touch `order`,
    // so unchecking restores a task to its natural place).
    return [
      ...arr.filter((t) => !t.completed),
      ...arr.filter((t) => t.completed),
    ];
  }, [visibleTasks, sort, getClient]);

  // Daily Top-5 focus list (curated, ordered by rank). Shown above the list.
  const priorityTasks = activeTasks
    .filter((t) => t.priorityRank != null)
    .sort((a, b) => a.priorityRank! - b.priorityRank!);
  const priorityFull = priorityTasks.length >= 5;
  const showTop5 = view === "list" && !showArchived && priorityTasks.length > 0;
  const mainTasks = showTop5
    ? sortedTasks.filter((t) => t.priorityRank == null)
    : sortedTasks;

  const pendingCount = activeTasks.filter((t) => !t.completed).length;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const doneTodayCount = activeTasks.filter(
    (t) => t.completed && t.completedAt && t.completedAt >= startOfToday
  ).length;
  const toReplyCount = activeTasks.filter(
    (t) => t.needsReply && !t.completed
  ).length;

  // List view gains a right-hand "To reply" panel when something is pending.
  const listWithReplies = view === "list" && toReplyCount > 0;

  const toggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  return (
    <main
      className={cn(
        "mx-auto min-h-screen w-full px-4 py-10 sm:px-6",
        view === "board"
          ? "max-w-[110rem]"
          : listWithReplies
          ? "max-w-5xl"
          : "max-w-2xl"
      )}
    >
      <div className="mb-6">
        <AppNav />
      </div>

      <div
        className={cn(
          listWithReplies &&
            "md:flex md:items-start md:gap-4 lg:gap-6 xl:justify-center"
        )}
      >
        <div
          className={cn(
            listWithReplies && "min-w-0 md:flex-1 xl:max-w-2xl"
          )}
        >
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Quick note"
            title="Quick note"
            onClick={() => openNote()}
          >
            <StickyNote className="h-4 w-4" />
          </Button>
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
          {(["list", "board", "projects"] as ViewMode[]).map((v) => (
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
              ) : v === "board" ? (
                <LayoutGrid className="h-3.5 w-3.5" />
              ) : (
                <FolderKanban className="h-3.5 w-3.5" />
              )}
              {v === "list" ? "List" : v === "board" ? "Board" : "Projects"}
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
        ) : view === "board" ? (
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
        ) : null}
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
            {(archivedCount > 0 || showArchived) && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                aria-pressed={showArchived}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  showArchived
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Archive className="h-3.5 w-3.5" />
                Archived
                {archivedCount > 0 && (
                  <span
                    className={cn(
                      "ml-0.5 rounded-full px-1.5 text-xs",
                      showArchived ? "bg-background/25" : "bg-background/60"
                    )}
                  >
                    {archivedCount}
                  </span>
                )}
              </button>
            )}
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
        ) : view === "projects" ? (
          <ProjectsView
            tasks={activeTasks}
            getClient={getClient}
            onToggleSubtask={toggleSubtask}
            onOpen={(id) => {
              setView("list");
              setExpandedId(id);
            }}
          />
        ) : view === "board" && groupBy === "client" ? (
          <BoardSwimlanes
            tasks={activeTasks}
            clients={clients}
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
        ) : view === "board" ? (
          <BoardView
            tasks={activeTasks}
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
        ) : (
          <>
            {showTop5 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Star
                    className="h-4 w-4 text-amber-500"
                    fill="currentColor"
                  />
                  Top 5 today
                  <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 text-xs font-medium text-amber-500">
                    {priorityTasks.length}/5
                  </span>
                </div>
                <TaskList
                  tasks={priorityTasks}
                  expandedId={expandedId}
                  onToggleExpand={toggleExpand}
                  onToggle={toggleTask}
                  onUpdate={updateTask}
                  onDelete={(id) => {
                    deleteTask(id);
                    setExpandedId((cur) => (cur === id ? null : cur));
                  }}
                  onArchive={toggleArchived}
                  onTogglePriority={togglePriority}
                  priorityFull={priorityFull}
                  onReorder={reorderPriorities}
                  dndDisabled={false}
                />
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Everything else
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

            {mainTasks.length === 0 ? (
              showTop5 ? null : (
                <EmptyState
                  hasTasks={tasks.length > 0}
                  archived={showArchived}
                />
              )
            ) : (
              <TaskList
                tasks={mainTasks}
                expandedId={expandedId}
                onToggleExpand={toggleExpand}
                onToggle={toggleTask}
                onUpdate={updateTask}
                onDelete={(id) => {
                  deleteTask(id);
                  setExpandedId((cur) => (cur === id ? null : cur));
                }}
                onArchive={toggleArchived}
                onTogglePriority={togglePriority}
                priorityFull={priorityFull}
                onReorder={reorderTasks}
                dndDisabled={sort !== "manual"}
              />
            )}
          </>
        )}
      </div>
        </div>

        {listWithReplies && (
          <ReplyPanel
            className="mt-6 md:mt-0 md:w-56 md:shrink-0 md:sticky md:top-10 md:max-h-[calc(100vh-5rem)] md:overflow-y-auto lg:w-64 xl:w-72"
            tasks={activeTasks}
            getClient={getClient}
            onUpdate={updateTask}
            onOpen={(id) => {
              setShowArchived(false);
              setExpandedId(id);
              requestAnimationFrame(() =>
                document
                  .getElementById(`task-${id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              );
            }}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState({
  hasTasks,
  archived,
}: {
  hasTasks: boolean;
  archived?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center">
      <p className="text-sm text-muted-foreground">
        {archived
          ? "No archived tasks."
          : hasTasks
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
