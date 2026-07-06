"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  ChevronDown,
  Clock,
  GripVertical,
  MessageSquare,
  Trash2,
} from "lucide-react";

import {
  cn,
  dueUrgency,
  formatDue,
  formatDuration,
  taskTotalSeconds,
} from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientBadge } from "@/components/client-badge";
import { TaskDetails } from "@/components/task-details";
import { useClients } from "@/hooks/use-clients";
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

export function TaskItem({
  task,
  expanded,
  onToggleExpand,
  onToggle,
  onUpdate,
  onDelete,
}: TaskItemProps) {
  const { getClient } = useClients();
  const client = getClient(task.client);

  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(task.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    } else {
      setTitleDraft(task.title);
    }
    setEditingTitle(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-colors",
        isDragging && "z-10 opacity-80 shadow-md",
        expanded && "ring-1 ring-border"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Checkbox
          checked={task.completed}
          onCheckedChange={onToggle}
          aria-label={task.completed ? "Mark as pending" : "Mark as done"}
        />

        {/* Title (and inline body toggle) */}
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
          onClick={() => {
            if (!editingTitle) onToggleExpand();
          }}
        >
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(task.title);
                  setEditingTitle(false);
                }
              }}
              className="w-full bg-transparent text-sm font-medium outline-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTitle(true);
              }}
              className={cn(
                "truncate text-sm font-medium",
                task.completed && "text-muted-foreground line-through opacity-60"
              )}
            >
              {task.title}
            </span>
          )}

          {client && <ClientBadge client={client} className="shrink-0" />}

          {task.needsReply && task.replyTo && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
              <MessageSquare className="h-3 w-3" />
              {task.replyTo}
            </span>
          )}

          {task.dueAt && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                task.completed
                  ? "bg-muted text-muted-foreground"
                  : dueUrgency(task.dueAt) === "overdue"
                  ? "bg-red-500/15 text-red-500"
                  : dueUrgency(task.dueAt) === "soon"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {formatDue(task.dueAt)}
            </span>
          )}

          {taskTotalSeconds(task) > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              title="Time tracked"
            >
              <Clock className="h-3 w-3" />
              {formatDuration(taskTotalSeconds(task))}
            </span>
          )}
        </div>

        {/* "Owe a message/reply" flag — always visible when set, hover-reveal otherwise */}
        <button
          onClick={() => onUpdate({ needsReply: !task.needsReply })}
          aria-label={
            task.needsReply ? "Clear reply flag" : "Flag: needs a message/reply"
          }
          aria-pressed={task.needsReply}
          title="Needs a message / reply"
          className={cn(
            "rounded p-1 transition-colors hover:bg-accent focus-visible:opacity-100",
            task.needsReply
              ? "text-amber-500 opacity-100 hover:text-amber-400"
              : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
          )}
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* Delete (appears on hover) */}
        <button
          onClick={onDelete}
          aria-label="Delete task"
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Expand chevron */}
        <button
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="rounded p-1 text-muted-foreground transition-transform hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded && (
        <TaskDetails task={task} onUpdate={onUpdate} onClose={onToggleExpand} />
      )}
    </div>
  );
}
