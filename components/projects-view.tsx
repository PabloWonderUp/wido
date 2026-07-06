"use client";

import * as React from "react";
import { ArrowUpDown, Check, FolderKanban } from "lucide-react";

import { cn } from "@/lib/utils";
import { STATUS_META, statusOf } from "@/lib/status";
import { ClientBadge } from "@/components/client-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client, Task } from "@/lib/types";

type ProjectSort = "order" | "progress" | "name";
const SORT_LABELS: Record<ProjectSort, string> = {
  order: "Manual",
  progress: "Progress",
  name: "Name",
};

function progressFraction(t: Task): number {
  const subs = t.subtasks ?? [];
  if (subs.length > 0) return subs.filter((s) => s.completed).length / subs.length;
  return statusOf(t) === "done" ? 1 : 0;
}

interface ProjectsViewProps {
  tasks: Task[];
  getClient: (id?: string) => Client | undefined;
  onToggleSubtask: (id: string, subId: string) => void;
  onOpen: (id: string) => void;
}

/** Vertical list of projects, each with status, progress and its subtasks. */
export function ProjectsView({
  tasks,
  getClient,
  onToggleSubtask,
  onOpen,
}: ProjectsViewProps) {
  const [sort, setSort] = React.useState<ProjectSort>("order");

  const projects = tasks.filter((t) => t.isProject);
  const sorted = React.useMemo(() => {
    const arr = [...projects];
    if (sort === "progress") arr.sort((a, b) => progressFraction(a) - progressFraction(b));
    else if (sort === "name") arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, sort]);

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No projects yet. Open a task and tap{" "}
          <span className="font-medium text-foreground">Make project</span> to
          add subtasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort: {SORT_LABELS[sort]}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABELS) as ProjectSort[]).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => setSort(s)}>
                {SORT_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {sorted.map((p) => {
        const subs = p.subtasks ?? [];
        const done = subs.filter((s) => s.completed).length;
        const total = subs.length;
        const pct =
          total > 0
            ? Math.round((done / total) * 100)
            : statusOf(p) === "done"
            ? 100
            : 0;
        const st = statusOf(p);
        const meta = STATUS_META[st];
        const client = getClient(p.client);

        return (
          <div
            key={p.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => onOpen(p.id)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <FolderKanban className="h-4 w-4 shrink-0 text-violet-500" />
                <span
                  className={cn(
                    "truncate font-semibold",
                    st === "done" && "text-muted-foreground line-through"
                  )}
                >
                  {p.title}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {client && <ClientBadge client={client} />}
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${meta.color}22`,
                    color: meta.color,
                  }}
                >
                  {meta.label}
                </span>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{total > 0 ? `${done}/${total} subtasks` : "No subtasks"}</span>
                {total > 0 && <span>{pct}%</span>}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Subtasks */}
            {subs.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleSubtask(p.id, s.id)}
                      aria-label={s.completed ? "Mark undone" : "Mark done"}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        s.completed
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-input hover:border-violet-500"
                      )}
                    >
                      {s.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <span
                      className={cn(
                        "text-sm",
                        s.completed && "text-muted-foreground line-through"
                      )}
                    >
                      {s.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
