"use client";

import { useEffect, useSyncExternalStore } from "react";
import { makeId } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";
import {
  getState,
  hydrate,
  isHydrated,
  setState,
  subscribe,
} from "./store";

export function useTasks() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  const hydrated = useSyncExternalStore(subscribe, isHydrated, () => false);

  useEffect(() => {
    hydrate();
  }, []);

  const addTask = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setState((prev) => {
      const minOrder = prev.tasks.reduce(
        (min, t) => Math.min(min, t.order),
        0
      );
      const newTask: Task = {
        id: makeId(),
        title: trimmed,
        completed: false,
        status: "todo",
        order: minOrder - 1, // newest on top
        createdAt: Date.now(),
      };
      return { ...prev, tasks: [newTask, ...prev.tasks] };
    });
  };

  const toggleTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== id) return t;
        const nowDone = !t.completed;
        return {
          ...t,
          completed: nowDone,
          status: nowDone ? "done" : "todo",
          completedAt: nowDone ? Date.now() : undefined,
        };
      }),
    }));
  };

  /** Set an explicit workflow status; keeps `completed`/`completedAt` in sync. */
  const setStatus = (id: string, status: TaskStatus) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== id) return t;
        const done = status === "done";
        return {
          ...t,
          status,
          completed: done,
          completedAt: done ? t.completedAt ?? Date.now() : undefined,
        };
      }),
    }));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const pushEntry = (
    id: string,
    seconds: number,
    label: string,
    manual: boolean
  ) => {
    if (seconds <= 0) return;
    const entry = {
      id: makeId(),
      seconds: Math.round(seconds),
      label: label || undefined,
      createdAt: Date.now(),
      manual,
    };
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? { ...t, timeEntries: [...(t.timeEntries ?? []), entry] }
          : t
      ),
    }));
  };

  /** Add tracked focus seconds to a task (from the timer). */
  const addTime = (id: string, seconds: number) =>
    pushEntry(id, seconds, "Focus session", false);

  /** Manually add a time block. */
  const addManualTime = (id: string, seconds: number, label = "") =>
    pushEntry(id, seconds, label, true);

  const updateTimeEntry = (
    id: string,
    entryId: string,
    updates: { seconds?: number; label?: string }
  ) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              timeEntries: (t.timeEntries ?? []).map((e) =>
                e.id === entryId ? { ...e, ...updates } : e
              ),
            }
          : t
      ),
    }));
  };

  const deleteTimeEntry = (id: string, entryId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              timeEntries: (t.timeEntries ?? []).filter(
                (e) => e.id !== entryId
              ),
            }
          : t
      ),
    }));
  };

  // --- Subtasks (inside a project task) ---

  const addSubtask = (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const sub = { id: makeId(), title: trimmed, completed: false };
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? { ...t, isProject: true, subtasks: [...(t.subtasks ?? []), sub] }
          : t
      ),
    }));
  };

  const toggleSubtask = (id: string, subId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              subtasks: (t.subtasks ?? []).map((s) =>
                s.id === subId ? { ...s, completed: !s.completed } : s
              ),
            }
          : t
      ),
    }));
  };

  const updateSubtask = (id: string, subId: string, title: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              subtasks: (t.subtasks ?? []).map((s) =>
                s.id === subId ? { ...s, title } : s
              ),
            }
          : t
      ),
    }));
  };

  const deleteSubtask = (id: string, subId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subId) }
          : t
      ),
    }));
  };

  const deleteTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  /**
   * Reorder from drag & drop. Receives the newly ordered ids of the *visible*
   * tasks; hidden tasks (filtered out) keep their slots so filtering never
   * scrambles the underlying order.
   */
  const reorderTasks = (visibleOrderedIds: string[]) => {
    setState((prev) => {
      const fullSorted = [...prev.tasks].sort((a, b) => a.order - b.order);
      const visible = new Set(visibleOrderedIds);
      let vi = 0;
      const sequence = fullSorted.map((t) =>
        visible.has(t.id) ? visibleOrderedIds[vi++] : t.id
      );
      const orderById = new Map(sequence.map((id, i) => [id, i]));
      return {
        ...prev,
        tasks: prev.tasks.map((t) => ({
          ...t,
          order: orderById.get(t.id) ?? t.order,
        })),
      };
    });
  };

  const sortedTasks = [...state.tasks].sort((a, b) => a.order - b.order);

  return {
    tasks: sortedTasks,
    hydrated,
    addTask,
    toggleTask,
    setStatus,
    updateTask,
    deleteTask,
    reorderTasks,
    addTime,
    addManualTime,
    updateTimeEntry,
    deleteTimeEntry,
    addSubtask,
    toggleSubtask,
    updateSubtask,
    deleteSubtask,
  };
}
