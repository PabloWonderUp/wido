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
import { CalendarClock, Check } from "lucide-react";

import { cn, dueUrgency, formatDue } from "@/lib/utils";
import { STATUSES, STATUS_META, statusOf } from "@/lib/status";
import type { Client, Task, TaskStatus } from "@/lib/types";

const NO_CLIENT = "__none__";

interface Props {
  tasks: Task[];
  clients: Client[];
  getClient: (id?: string) => Client | undefined;
  onToggle: (id: string) => void;
  onSetClient: (id: string, clientId: string | undefined) => void;
  onSetStatus: (id: string, status: TaskStatus) => void;
  onReorder: (orderedIds: string[]) => void;
  onOpen: (id: string) => void;
}

interface Lane {
  key: string;
  title: string;
  color?: string;
}

const cellId = (lane: string, status: string) => `cell:${lane}:${status}`;

export function BoardSwimlanes({
  tasks,
  clients,
  getClient,
  onToggle,
  onSetClient,
  onSetStatus,
  onReorder,
  onOpen,
}: Props) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const lanes: Lane[] = [
    ...clients.map((c) => ({ key: c.id, title: c.name, color: c.color })),
    { key: NO_CLIENT, title: "No client" },
  ];

  const laneOf = (t: Task) => t.client ?? NO_CLIENT;

  // grouped[`lane:status`] = ordered task ids
  const grouped: Record<string, string[]> = {};
  for (const lane of lanes)
    for (const s of STATUSES) grouped[cellId(lane.key, s)] = [];
  for (const t of tasks) {
    const key = cellId(laneOf(t), statusOf(t));
    (grouped[key] ??= []).push(t.id);
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = active.id as string;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const overId = over.id as string;
    let lane: string;
    let status: TaskStatus;
    if (overId.startsWith("cell:")) {
      const [, l, s] = overId.split(":");
      lane = l;
      status = s as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      lane = laneOf(overTask);
      status = statusOf(overTask);
    }

    const srcLane = laneOf(task);
    const srcStatus = statusOf(task);
    if (lane !== srcLane)
      onSetClient(id, lane === NO_CLIENT ? undefined : lane);
    if (status !== srcStatus) onSetStatus(id, status);

    // Rebuild global order reflecting the move.
    const next: Record<string, string[]> = {};
    for (const k of Object.keys(grouped)) next[k] = [...grouped[k]];
    next[cellId(srcLane, srcStatus)] = next[cellId(srcLane, srcStatus)].filter(
      (x) => x !== id
    );
    const target = cellId(lane, status);
    const list = next[target] ?? (next[target] = []);
    if (overId.startsWith("cell:")) list.push(id);
    else {
      const idx = list.indexOf(overId);
      list.splice(idx < 0 ? list.length : idx, 0, id);
    }
    const ordered = lanes.flatMap((ln) =>
      STATUSES.flatMap((s) => next[cellId(ln.key, s)] ?? [])
    );
    onReorder(ordered);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="space-y-4">
        {lanes.map((lane) => {
          const laneCount = STATUSES.reduce(
            (n, s) => n + (grouped[cellId(lane.key, s)]?.length ?? 0),
            0
          );
          return (
            <div
              key={lane.key}
              className="rounded-xl border border-border bg-muted/20 p-3"
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lane.color ?? "#71717a" }}
                />
                <span className="text-sm font-semibold">{lane.title}</span>
                <span className="text-xs text-muted-foreground">
                  {laneCount}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {STATUSES.map((s) => (
                  <StatusCell
                    key={s}
                    laneKey={lane.key}
                    status={s}
                    taskIds={grouped[cellId(lane.key, s)] ?? []}
                    tasks={tasks}
                    getClient={getClient}
                    onToggle={onToggle}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <Card task={activeTask} getClient={getClient} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StatusCell({
  laneKey,
  status,
  taskIds,
  tasks,
  getClient,
  onToggle,
  onOpen,
}: {
  laneKey: string;
  status: TaskStatus;
  taskIds: string[];
  tasks: Task[];
  getClient: (id?: string) => Client | undefined;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(laneKey, status) });
  const meta = STATUS_META[status];

  return (
    <div className="flex min-w-[11rem] flex-1 flex-col">
      <div className="mb-1.5 flex items-center gap-1.5 px-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        <span className="text-xs font-medium text-muted-foreground">
          {meta.label}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {taskIds.length || ""}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[3.5rem] flex-1 flex-col gap-2 rounded-lg border border-border/60 p-1.5 transition-colors",
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
  const style = { transform: CSS.Transform.toString(transform), transition };
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
  return (
    <div
      className={cn(
        "cursor-grab rounded-lg border border-border bg-card p-2 shadow-sm active:cursor-grabbing",
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
          {task.completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
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
      {task.dueAt && (
        <div className="mt-1.5 pl-6">
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
        </div>
      )}
    </div>
  );
}
