"use client";

import { useEffect, useSyncExternalStore } from "react";
import { makeId } from "@/lib/utils";
import type { Note } from "@/lib/types";
import { getState, hydrate, isHydrated, setState, subscribe } from "./store";

export function useNotes() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  const hydrated = useSyncExternalStore(subscribe, isHydrated, () => false);

  useEffect(() => {
    hydrate();
  }, []);

  /** Create a note; returns its id so callers can open it right away. */
  const addNote = (data: Partial<Note> = {}): string => {
    const now = Date.now();
    const note: Note = {
      id: makeId(),
      title: data.title,
      content: data.content ?? "",
      taskId: data.taskId,
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
    return note.id;
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
      ),
    }));
  };

  const deleteNote = (id: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
    }));
  };

  const getNote = (id?: string) =>
    id ? state.notes.find((n) => n.id === id) : undefined;

  const notesForTask = (taskId: string) =>
    state.notes
      .filter((n) => n.taskId === taskId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    notes: [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt),
    hydrated,
    addNote,
    updateNote,
    deleteNote,
    getNote,
    notesForTask,
  };
}
