"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Check, FolderKanban } from "lucide-react";

import { cn, dueUrgency, formatDue } from "@/lib/utils";
import { STATUSES, STATUS_META, statusOf } from "@/lib/status";
import { ClientBadge } from "@/components/client-badge";
import type { BoardGroupBy, Client, Task, TaskStatus } from "@/lib/types";

const NO_CLIENT = "__none__";

interface BoardViewProps {
  tasks: Task[];
  clients: Client[];
  groupBy: BoardGroupBy;
  getClient: (id?: string) => Client | undefined;
  onToggle: (id: string) => void;
  onSetClient: (id: string, clientId: string | undefined) => void;
  onSetStatus: (id: string, status: TaskStatus) => void;
  onReorder: (orderedIds: string[]) => void;
  onOpen: (id: string) => void;
}

interface Column {
  key: string;
  title: string;
  color?: string;
}

export function BoardView({
  tasks,
  clients,
  groupBy,
  getClient,
  onToggle,
  onSetClient,
  onSetStatus,
  onReorder,
  onOpen,
}: BoardViewProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columns: Column[] =
    groupBy === "status"
      ? STATUSES.map((s) => ({
          key: s,
          title: STATUS_META[s].label,
          color: STATUS_META[s].color,
        }))
      : [
          ...clients.map((c) => ({ key: c.id, title: c.name, color: c.color })),
          { key: NO_CLIENT, title: "No client" },
        ];

  const columnOf = (t: Task): string =>
    groupBy === "status" ? statusOf(t) : t.client ?? NO_CLIENT;

  // Map column key -> ordered task ids (tasks arrive pre-sorted by order).
  const grouped: Record<string, string[]> = {};
  for (const col of columns) grouped[col.key] = [];
  for (const t of tasks) {
    const key = columnOf(t);
    (grouped[key] ??= []).push(t.id);
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeTaskId = active.id as string;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    const overId = over.id as string;
    // Target column: dropped on a column zone ("col:KEY") or on a card.
    let targetCol: string;
    if (overId.startsWith("col:")) {
      targetCol = overId.slice(4);
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetCol = columnOf(overTask);
    }

    const sourceCol = columnOf(task);

    // Reassign the grouping field if the card changed column.
    if (targetCol !== sourceCol) {
      if (groupBy === "status") {
        onSetStatus(activeTaskId, targetCol as TaskStatus);
      } else {
        onSetClient(activeTaskId, targetCol === NO_CLIENT ? undefined : targetCol);
      }
    }

    // Rebuild the global order reflecting the drop position.
    const next: Record<string, string[]> = {};
    for (const col of columns) next[col.key] = [...(grouped[col.key] ?? [])];
    // remove from source
    next[sourceCol] = next[sourceCol].filter((id) => id !== activeTaskId);
    // insert into target at the over position
    const targetList = next[targetCol] ?? (next[targetCol] = []);
    if (overId.startsWith("col:")) {
      targetList.push(activeTaskId);
    } else {
      const idx = targetList.indexOf(overId);
      targetList.splice(idx < 0 ? targetList.length : idx, 0, activeTaskId);
    }

    const orderedIds = columns.flatMap((c) => next[c.key] ?? []);
    onReorder(orderedIds);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <BoardColumn
            key={col.key}
            column={col}
            taskIds={grouped[col.key] ?? []}
            tasks={tasks}
            getClient={getClient}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <Card task={activeTask} getClient={getClient} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  taskIds,
  tasks,
  getClient,
  onToggle,
  onOpen,
}: {
  column: Column;
  taskIds: string[];
  tasks: Task[];
  getClient: (id?: string) => Client | undefined;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` });

  return (
    <div className="flex min-w-[15rem] flex-1 flex-col md:min-w-[16rem]">
      <div className="mb-2 flex items-center gap-2 px-1">
        {column.color && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: column.color }}
          />
        )}
        <span className="text-sm font-semibold">{column.title}</span>
        <span className="text-xs text-muted-foreground">{taskIds.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2 transition-colors",
          isOver && "border-foreground/30 bg-accent/50"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((id) => {
            const task = tasks.find((t) => t.id === id);
            if (!task) return null;
            return (
              <SortableCard
                key={id}
                task={task}
                getClient={getClient}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            );
          })}
        </SortableContext>
        {taskIds.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

function SortableCard({
  task,
  getClient,
  onToggle,
  onOpen,
}: {
  task: Task;
  getClient: (id?: string) => Client | undefined;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card task={task} getClient={getClient} onToggle={onToggle} onOpen={onOpen} />
    </div>
  );
}

function Card({
  task,
  getClient,
  onToggle,
  onOpen,
  dragging,
}: {
  task: Task;
  getClient: (id?: string) => Client | undefined;
  onToggle?: (id: string) => void;
  onOpen?: (id: string) => void;
  dragging?: boolean;
}) {
  const client = getClient(task.client);
  const status = statusOf(task);

  return (
    <div
      className={cn(
        "cursor-grab rounded-lg border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing",
        dragging && "rotate-1 shadow-md"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggle?.(task.id)}
          aria-label={task.completed ? "Mark pending" : "Mark done"}
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            task.completed
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:border-foreground"
          )}
        >
          {task.completed && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOpen?.(task.id)}
          className={cn(
            "flex-1 text-left text-sm font-medium leading-snug",
            task.completed && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </button>
      </div>

      {(client || task.dueAt || task.isProject || status !== "todo") && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
          {status !== "todo" && status !== "done" && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${STATUS_META[status].color}22`,
                color: STATUS_META[status].color,
              }}
            >
              {STATUS_META[status].label}
            </span>
          )}
          {task.isProject && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-500">
              <FolderKanban className="h-3 w-3" />
              {(task.subtasks?.length ?? 0) > 0
                ? `${task.subtasks!.filter((s) => s.completed).length}/${
                    task.subtasks!.length
                  }`
                : "Project"}
            </span>
          )}
          {client && <ClientBadge client={client} />}
          {task.dueAt && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
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
        </div>
      )}

      {task.isProject && (task.subtasks?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1 pl-6">
          {task.subtasks!.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className={cn(
                  "flex h-3 w-3 shrink-0 items-center justify-center rounded-full border",
                  s.completed
                    ? "border-violet-500 bg-violet-500 text-white"
                    : "border-input"
                )}
              >
                {s.completed && <Check className="h-2 w-2" strokeWidth={4} />}
              </span>
              <span className={cn("truncate", s.completed && "line-through")}>
                {s.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
