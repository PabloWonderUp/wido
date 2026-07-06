"use client";

import { useSyncExternalStore } from "react";
import { makeId, nextClientColor } from "@/lib/utils";
import type { Client } from "@/lib/types";
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

  const getClient = (id?: string): Client | undefined =>
    id ? state.clients.find((c) => c.id === id) : undefined;

  return {
    clients: state.clients,
    addClient,
    getClient,
  };
}
