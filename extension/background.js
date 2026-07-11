// Background service worker.
//   1. Keeps the toolbar badge / goal alarm in sync with the timer.
//   2. Bridges to Wido: borrows the logged-in session from an open Wido tab
//      (opening one in the background and closing it if needed), caches the
//      short-lived access token, and runs Supabase reads/writes for the popup.

import {
  restLoadState,
  restAppendTimeEntry,
  restCreateTask,
} from "./lib/supabase.js";
import {
  TIMER_KEY,
  getTimer,
  elapsedMs,
  applyTimer,
  toWebStopwatch,
  fromWebStopwatch,
} from "./lib/timer.js";
import { WIDO_OPEN_URL, SUPABASE_PROJECT_REF } from "./config.js";

const TICK_ALARM = "wido-tick";
const GOAL_ALARM = "wido-goal";
const RUNNING_COLOR = "#22C55E";
const TOKEN_KEY = "wido_ext_token";
const WIDO_MATCH = [
  "https://wido-theta.vercel.app/*",
  "http://localhost:3002/*",
];

// ---- badge + goal alarm ---------------------------------------------------

async function refreshBadge() {
  const t = await getTimer();
  if (!t.running) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const mins = Math.floor(elapsedMs(t) / 60000);
  await chrome.action.setBadgeBackgroundColor({ color: RUNNING_COLOR });
  await chrome.action.setBadgeText({ text: mins > 0 ? String(mins) : "▶" });
}

async function reschedule() {
  const t = await getTimer();
  await chrome.alarms.clear(TICK_ALARM);
  await chrome.alarms.clear(GOAL_ALARM);
  if (!t.running) return;
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  if (t.goalMs != null) {
    const remaining = t.goalMs - elapsedMs(t);
    // Only arm if the goal is still ahead — avoids re-firing on resume past it.
    if (remaining > 0) {
      chrome.alarms.create(GOAL_ALARM, { when: Date.now() + remaining });
    }
  }
}

// MV3 service workers can't play audio — do it from an offscreen document.
async function playAlarmSound() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play the timer goal alarm sound.",
      });
      await sleep(150); // let the offscreen script register its listener
    }
    await chrome.runtime.sendMessage({ type: "PLAY_ALARM" });
  } catch {
    /* offscreen unavailable — the notification still fires */
  }
}

async function fireGoal() {
  const t = await getTimer();
  if (!t.running || t.goalMs == null || elapsedMs(t) < t.goalMs) return;
  if (t.alarmEnabled) {
    await playAlarmSound();
    chrome.notifications.create(GOAL_ALARM, {
      type: "basic",
      iconUrl: "icons/icon-192.png",
      title: "Wido Timer — goal reached",
      message: t.attachLabel
        ? `${t.attachLabel} hit its target. Save the time?`
        : "Your timer hit its target. Save the time?",
      requireInteraction: true,
    });
  }
  await chrome.action.setBadgeText({ text: "✓" });
}

// ---- bridge to Wido -------------------------------------------------------

async function getCachedToken() {
  const { [TOKEN_KEY]: t } = await chrome.storage.local.get(TOKEN_KEY);
  if (t?.access_token && t.user_id && t.expires_at * 1000 > Date.now() + 60000) {
    return t;
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findWidoTab() {
  const tabs = await chrome.tabs.query({ url: WIDO_MATCH });
  return tabs[0] ?? null;
}

function waitForTabLoad(tabId, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const finish = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeoutMs);
  });
}

// Runs INSIDE the Wido tab: reads the Supabase session from localStorage.
// Handles chunked (`...auth-token.0/.1`) and base64-prefixed storage. Must be
// self-contained (serialized by executeScript) — only uses its `ref` arg.
function readSessionInPage(ref) {
  try {
    let base = `sb-${ref}-auth-token`;
    if (
      localStorage.getItem(base) == null &&
      localStorage.getItem(base + ".0") == null
    ) {
      base = null;
      for (let j = 0; j < localStorage.length; j++) {
        const k = localStorage.key(j);
        const m = k && k.match(/^(sb-.*-auth-token)(\.\d+)?$/);
        if (m) {
          base = m[1];
          break;
        }
      }
    }
    if (!base) return null;

    let raw = localStorage.getItem(base);
    if (raw == null) {
      let combined = "";
      let i = 0;
      let part;
      while ((part = localStorage.getItem(`${base}.${i}`)) != null) {
        combined += part;
        i++;
      }
      raw = combined || null;
    }
    if (raw == null) return null;

    let str = String(raw);
    if (str.startsWith("base64-")) {
      try {
        str = atob(str.slice(7));
      } catch {
        /* leave as-is */
      }
    }
    const v = JSON.parse(str);
    const s = v && v.access_token ? v : v && v.currentSession ? v.currentSession : null;
    if (!s || !s.access_token) return null;
    return {
      access_token: s.access_token,
      expires_at: typeof s.expires_at === "number" ? s.expires_at : null,
      user_id: s.user && s.user.id ? s.user.id : null,
    };
  } catch {
    return null;
  }
}

async function readSessionFromTab(tabId) {
  try {
    const [out] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readSessionInPage,
      args: [SUPABASE_PROJECT_REF],
    });
    return out?.result ?? null;
  } catch {
    return null;
  }
}

function usable(session) {
  return (
    session?.access_token &&
    session.user_id &&
    (!session.expires_at || session.expires_at * 1000 > Date.now() + 5000)
  );
}

// Returns { access_token, user_id, expires_at } or null. Reads the session from
// an open Wido tab via executeScript (works on already-open tabs, no reload);
// opens a background tab (and closes it) if none is open.
async function acquireSession({ allowOpen = true } = {}) {
  const cached = await getCachedToken();
  if (cached) return cached;

  let tab = await findWidoTab();
  let opened = false;
  if (!tab) {
    if (!allowOpen) return null;
    tab = await chrome.tabs.create({ url: WIDO_OPEN_URL, active: false });
    opened = true;
    await waitForTabLoad(tab.id);
  }

  let session = null;
  for (let i = 0; i < 16; i++) {
    session = await readSessionFromTab(tab.id);
    if (usable(session)) break;
    await sleep(500);
  }
  if (opened && tab?.id) chrome.tabs.remove(tab.id).catch(() => {});

  if (usable(session)) {
    await chrome.storage.local.set({ [TOKEN_KEY]: session });
    return session;
  }
  return null;
}

// ---- stopwatch sync with the web app --------------------------------------

function readWebStopwatchInPage() {
  try {
    const raw = localStorage.getItem("wido-stopwatch");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeWebStopwatchInPage(state) {
  try {
    localStorage.setItem("wido-stopwatch", JSON.stringify(state));
    // Same-tab writes don't fire `storage`; nudge the app to re-read.
    window.dispatchEvent(new CustomEvent("wido-stopwatch-ping"));
    return true;
  } catch {
    return false;
  }
}

async function readWebStopwatch(tabId) {
  try {
    const [out] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readWebStopwatchInPage,
    });
    return out?.result ?? null;
  } catch {
    return null;
  }
}

async function writeWebStopwatch(tabId, state) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: writeWebStopwatchInPage,
      args: [state],
    });
    return true;
  } catch {
    return false;
  }
}

let reconciling = false;

// Last-write-wins between the extension timer and the web `wido-stopwatch`.
// No-ops if no Wido tab is open (nothing to push to; we'll sync on next load).
async function reconcile(tabId) {
  if (reconciling) return;
  reconciling = true;
  try {
    let target = tabId ? { id: tabId } : await findWidoTab();
    if (!target) return;
    const web = await readWebStopwatch(target.id);
    const ext = await getTimer();
    const webT = web && typeof web.updatedAt === "number" ? web.updatedAt : 0;
    const extT = ext.updatedAt || 0;

    if (web && webT > extT) {
      await applyTimer(fromWebStopwatch(web, ext.attachLabel));
    } else if (!web || extT > webT) {
      await writeWebStopwatch(target.id, toWebStopwatch(ext, web));
    }
  } finally {
    reconciling = false;
  }
}

async function handleGetEntities() {
  const session = await acquireSession();
  if (!session) return { ok: false, reason: "NOT_SIGNED_IN" };
  try {
    const state = await restLoadState(session.access_token, session.user_id);
    return {
      ok: true,
      tasks: state.tasks.filter((t) => !t.completed),
      clients: state.clients,
    };
  } catch (e) {
    await chrome.storage.local.remove(TOKEN_KEY); // maybe stale — force reopen
    return { ok: false, reason: "error", message: e.message };
  }
}

async function handleSaveTime(attach, seconds) {
  const session = await acquireSession();
  if (!session) return { ok: false, reason: "NOT_SIGNED_IN" };
  try {
    const entry = await restAppendTimeEntry(
      session.access_token,
      session.user_id,
      attach,
      seconds
    );
    return { ok: true, entry };
  } catch (e) {
    await chrome.storage.local.remove(TOKEN_KEY);
    return { ok: false, reason: "error", message: e.message };
  }
}

async function handleCreateTask(title, clientId) {
  const session = await acquireSession();
  if (!session) return { ok: false, reason: "NOT_SIGNED_IN" };
  try {
    const task = await restCreateTask(
      session.access_token,
      session.user_id,
      title,
      clientId
    );
    return { ok: true, task };
  } catch (e) {
    await chrome.storage.local.remove(TOKEN_KEY);
    return { ok: false, reason: "error", message: e.message };
  }
}

// ---- listeners ------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();
  reschedule();
});
chrome.runtime.onStartup.addListener(() => {
  refreshBadge();
  reschedule();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[TIMER_KEY]) {
    refreshBadge();
    reschedule();
    reconcile(); // push the change to an open Wido tab (if any)
  }
});

// When a Wido tab finishes loading, reconcile so it reflects the latest state.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  if (WIDO_MATCH.some((m) => matchesGlob(m, tab.url))) reconcile(tabId);
});

function matchesGlob(pattern, url) {
  const re = new RegExp(
    "^" + pattern.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$"
  );
  return re.test(url);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) refreshBadge();
  if (alarm.name === GOAL_ALARM) fireGoal();
});

chrome.notifications.onClicked.addListener((id) => {
  if (id === GOAL_ALARM) chrome.notifications.clear(id);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_ENTITIES") {
    handleGetEntities().then(sendResponse);
    return true;
  }
  if (msg?.type === "SAVE_TIME") {
    handleSaveTime(msg.attach, msg.seconds).then(sendResponse);
    return true;
  }
  if (msg?.type === "CREATE_TASK") {
    handleCreateTask(msg.title, msg.clientId).then(sendResponse);
    return true;
  }
  if (msg?.type === "SYNC") {
    reconcile().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "OPEN_WIDO") {
    chrome.tabs.create({ url: WIDO_OPEN_URL, active: true });
    sendResponse({ ok: true });
    return true;
  }
});
