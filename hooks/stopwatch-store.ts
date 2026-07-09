"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { makeId } from "@/lib/utils";
import { primeAudio } from "@/lib/alarm";
import type { TimeEntry } from "@/lib/types";
import { setState as setAppState } from "./store";

/**
 * A tiny global stopwatch (counts up). Lives outside React so it survives
 * navigation, and persists to localStorage so it survives reloads — the
 * elapsed time is derived from a start timestamp, not a ticking counter.
 *
 * On save it can log the elapsed time to a task or a client (which then shows
 * up in Hours), or just be a plain day chronometer if nothing is attached.
 */

const KEY = "wido-stopwatch";

export interface StopwatchAttach {
  type: "task" | "client";
  id: string;
}

interface SW {
  running: boolean;
  startedAt: number | null; // epoch ms the current run segment began
  accumulatedMs: number; // completed (paused) time before this segment
  laps: number[]; // elapsed-ms marks
  attach: StopwatchAttach | null;
  goalMs: number | null; // optional target; alarm fires when reached
  alarmEnabled: boolean; // play a sound when the goal is hit
}

let sw: SW = {
  running: false,
  startedAt: null,
  accumulatedMs: 0,
  laps: [],
  attach: null,
  goalMs: null,
  alarmEnabled: true,
};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(sw));
  } catch {
    /* ignore */
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      sw = {
        running: !!p.running,
        startedAt: typeof p.startedAt === "number" ? p.startedAt : null,
        accumulatedMs: typeof p.accumulatedMs === "number" ? p.accumulatedMs : 0,
        laps: Array.isArray(p.laps) ? p.laps : [],
        attach: p.attach ?? null,
        goalMs: typeof p.goalMs === "number" ? p.goalMs : null,
        alarmEnabled: p.alarmEnabled !== false,
      };
    }
  } catch {
    /* ignore */
  }
  emit();
}

function set(next: Partial<SW>) {
  sw = { ...sw, ...next };
  persist();
  emit();
}

function getState() {
  return sw;
}

export function elapsedMs(now = Date.now()): number {
  return sw.accumulatedMs + (sw.running && sw.startedAt ? now - sw.startedAt : 0);
}

function start() {
  if (sw.running) return;
  primeAudio(); // called from a click — unlocks audio for the later alarm
  set({ running: true, startedAt: Date.now() });
}

function pause() {
  if (!sw.running) return;
  set({ running: false, startedAt: null, accumulatedMs: elapsedMs() });
}

function toggle() {
  if (sw.running) pause();
  else start();
}

function lap() {
  set({ laps: [...sw.laps, elapsedMs()] });
}

function setAttach(attach: StopwatchAttach | null) {
  set({ attach });
}

function setGoal(goalMs: number | null) {
  set({ goalMs });
}

function toggleAlarm() {
  set({ alarmEnabled: !sw.alarmEnabled });
}

function reset() {
  set({ running: false, startedAt: null, accumulatedMs: 0, laps: [] });
}

/** Log the elapsed time (if attached) and reset. Returns seconds logged. */
function saveAndReset(): number {
  const seconds = Math.round(elapsedMs() / 1000);
  const attach = sw.attach;
  if (attach && seconds > 0) {
    const entry: TimeEntry = {
      id: makeId(),
      seconds,
      label: "Stopwatch",
      createdAt: Date.now(),
      manual: false,
    };
    setAppState((prev) =>
      attach.type === "task"
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === attach.id
                ? { ...t, timeEntries: [...(t.timeEntries ?? []), entry] }
                : t
            ),
          }
        : {
            ...prev,
            clients: prev.clients.map((c) =>
              c.id === attach.id
                ? { ...c, timeEntries: [...(c.timeEntries ?? []), entry] }
                : c
            ),
          }
    );
  }
  set({ running: false, startedAt: null, accumulatedMs: 0, laps: [] });
  return seconds;
}

export const stopwatchActions = {
  start,
  pause,
  toggle,
  lap,
  setAttach,
  setGoal,
  toggleAlarm,
  reset,
  saveAndReset,
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Subscribe to the stopwatch and tick every second while it runs. */
export function useStopwatch() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  const [mounted, setMounted] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    load();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  return {
    running: state.running,
    laps: state.laps,
    attach: state.attach,
    goalMs: state.goalMs,
    alarmEnabled: state.alarmEnabled,
    elapsedMs: mounted ? elapsedMs() : 0,
    hasTime: mounted && (state.running || elapsedMs() > 0),
    mounted,
    ...stopwatchActions,
  };
}
