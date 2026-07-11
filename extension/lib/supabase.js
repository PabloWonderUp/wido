// Supabase data access (PostgREST) using an access token supplied by the bridge.
// No auth/session management here — the web app owns the login; we just borrow
// its current access token to read/write the shared `app_state` blob.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const REST = `${SUPABASE_URL}/rest/v1`;

function headers(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Loads the whole AppState ({ tasks, clients, notes }). Empty shape if no row.
export async function restLoadState(token, userId) {
  const res = await fetch(
    `${REST}/app_state?user_id=eq.${userId}&select=state`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(await readError(res));
  const rows = await res.json();
  const state = rows[0]?.state ?? {};
  return {
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    clients: Array.isArray(state.clients) ? state.clients : [],
    notes: Array.isArray(state.notes) ? state.notes : [],
  };
}

// Re-reads the latest state, appends a TimeEntry to the target task/client, and
// upserts. Re-reading first avoids clobbering concurrent web edits — we only
// touch the target's `timeEntries` array.
export async function restAppendTimeEntry(token, userId, attach, seconds) {
  if (!attach || seconds <= 0) return null;
  const state = await restLoadState(token, userId);

  const entry = {
    id: crypto.randomUUID(),
    seconds,
    label: "Stopwatch",
    createdAt: Date.now(),
    manual: false,
  };

  const collection = attach.type === "task" ? state.tasks : state.clients;
  const target = collection.find((x) => x.id === attach.id);
  if (!target) {
    throw new Error(`That ${attach.type} no longer exists in Wido.`);
  }
  target.timeEntries = [...(target.timeEntries ?? []), entry];

  const res = await fetch(`${REST}/app_state`, {
    method: "POST",
    headers: { ...headers(token), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return entry;
}

// Creates a task (mirrors the app's addTask: prepend, negative order, todo).
// Returns the new task so the popup can select it immediately.
export async function restCreateTask(token, userId, title, clientId) {
  const trimmed = (title ?? "").trim();
  if (!trimmed) throw new Error("Enter a task title.");
  const state = await restLoadState(token, userId);
  const minOrder = state.tasks.reduce((m, t) => Math.min(m, t.order ?? 0), 0);
  const task = {
    id: crypto.randomUUID(),
    title: trimmed,
    completed: false,
    status: "todo",
    order: minOrder - 1,
    createdAt: Date.now(),
    ...(clientId ? { client: clientId } : {}),
  };
  state.tasks = [task, ...state.tasks];

  const res = await fetch(`${REST}/app_state`, {
    method: "POST",
    headers: { ...headers(token), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return task;
}

async function readError(res) {
  try {
    const body = await res.json();
    return body.msg || body.message || body.error_description || res.statusText;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}
