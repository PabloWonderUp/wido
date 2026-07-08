"use client";

import { useSyncExternalStore } from "react";
import { makeId, nextClientColor } from "@/lib/utils";
import type { Client, TimeEntry } from "@/lib/types";
import { getState, setState, subscribe } from "./store";

export function useClients() {
  const state = useSyncExternalStore(subscribe, getState, getState);

  /** Create a client (unless one with the same name exists) and return it. */
  const addClient = (name: string): Client | undefined => {
    const trimmed = name.trim();
    if (!trimmed) return undefined;

    const existing = state.clients.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;

    const client: Client = {
      id: makeId(),
      name: trimmed,
      color: nextClientColor(state.clients.length),
    };
    setState((prev) => ({ ...prev, clients: [...prev.clients, client] }));
    return client;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setState((prev) => ({
      ...prev,
      clients: prev.clients.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  };

  /** Delete a client and clear it from any task that referenced it. */
  const deleteClient = (id: string) => {
    setState((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== id),
      tasks: prev.tasks.map((t) =>
        t.client === id ? { ...t, client: undefined } : t
      ),
    }));
  };

  const getClient = (id?: string): Client | undefined =>
    id ? state.clients.find((c) => c.id === id) : undefined;

  /** Log hours directly to a client (not tied to a task). */
  const addClientTime = (
    id: string,
    seconds: number,
    note = "",
    createdAt = Date.now()
  ) => {
    if (seconds <= 0) return;
    const entry: TimeEntry = {
      id: makeId(),
      seconds: Math.round(seconds),
      label: note.trim() || undefined,
      createdAt,
      manual: true,
    };
    setState((prev) => ({
      ...prev,
      clients: prev.clients.map((c) =>
        c.id === id
          ? { ...c, timeEntries: [...(c.timeEntries ?? []), entry] }
          : c
      ),
    }));
  };

  const deleteClientTime = (id: string, entryId: string) => {
    setState((prev) => ({
      ...prev,
      clients: prev.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              timeEntries: (c.timeEntries ?? []).filter(
                (e) => e.id !== entryId
              ),
            }
          : c
      ),
    }));
  };

  return {
    clients: state.clients,
    addClient,
    updateClient,
    deleteClient,
    getClient,
    addClientTime,
    deleteClientTime,
  };
}
