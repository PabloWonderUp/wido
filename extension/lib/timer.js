// Stopwatch state — mirrors the app's `wido-stopwatch` model: elapsed time is
// derived from a start timestamp, never a ticking counter, so it stays correct
// across tabs, popup reopens, and service-worker suspensions.
// Stored in chrome.storage.local so every extension surface reads the same state.

export const TIMER_KEY = "wido_ext_timer";

export const DEFAULT_TIMER = {
  running: false,
  startedAt: null, // epoch ms the current run segment began
  accumulatedMs: 0, // completed (paused) time before this segment
  attach: null, // { type: "task"|"client", id: string } | null
  attachLabel: null, // cached display label for the popup/notification
  goalMs: null, // optional target; alarm fires when reached
  alarmEnabled: true,
  updatedAt: 0, // last write time — arbitrates sync with the web app
};

export async function getTimer() {
  const { [TIMER_KEY]: t } = await chrome.storage.local.get(TIMER_KEY);
  return { ...DEFAULT_TIMER, ...(t ?? {}) };
}

// User-driven change: stamps updatedAt so it wins the last-write-wins sync.
export async function setTimer(patch) {
  const next = { ...(await getTimer()), ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [TIMER_KEY]: next });
  return next;
}

// Adopt an exact state (e.g. pulled from the web) WITHOUT restamping updatedAt,
// so it doesn't bounce straight back to the web as a "newer" write.
export async function applyTimer(state) {
  const next = { ...DEFAULT_TIMER, ...state };
  await chrome.storage.local.set({ [TIMER_KEY]: next });
  return next;
}

// ---- mapping to/from the web app's `wido-stopwatch` shape -----------------

export function toWebStopwatch(t, existing) {
  return {
    running: t.running,
    startedAt: t.startedAt,
    accumulatedMs: t.accumulatedMs,
    laps: Array.isArray(existing?.laps) ? existing.laps : [],
    attach: t.attach,
    goalMs: t.goalMs,
    alarmEnabled: t.alarmEnabled,
    updatedAt: t.updatedAt || 0,
  };
}

export function fromWebStopwatch(w, prevLabel) {
  return {
    running: !!w.running,
    startedAt: typeof w.startedAt === "number" ? w.startedAt : null,
    accumulatedMs: typeof w.accumulatedMs === "number" ? w.accumulatedMs : 0,
    attach: w.attach ?? null,
    attachLabel: prevLabel ?? null,
    goalMs: typeof w.goalMs === "number" ? w.goalMs : null,
    alarmEnabled: w.alarmEnabled !== false,
    updatedAt: typeof w.updatedAt === "number" ? w.updatedAt : 0,
  };
}

export function elapsedMs(t, now = Date.now()) {
  return t.accumulatedMs + (t.running && t.startedAt ? now - t.startedAt : 0);
}

// ---- actions --------------------------------------------------------------

export async function start() {
  const t = await getTimer();
  if (t.running) return t;
  return setTimer({ running: true, startedAt: Date.now() });
}

export async function pause() {
  const t = await getTimer();
  if (!t.running) return t;
  return setTimer({
    running: false,
    startedAt: null,
    accumulatedMs: elapsedMs(t),
  });
}

// Discard: back to zero, keep the attachment/goal for the next run.
export async function reset() {
  return setTimer({ running: false, startedAt: null, accumulatedMs: 0 });
}

export async function setAttach(attach, attachLabel) {
  return setTimer({ attach, attachLabel: attachLabel ?? null });
}

export async function setGoal(goalMs) {
  return setTimer({ goalMs });
}

export async function toggleAlarm() {
  const t = await getTimer();
  return setTimer({ alarmEnabled: !t.alarmEnabled });
}

// ---- formatting -----------------------------------------------------------

export function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
