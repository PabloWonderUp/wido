import {
  TIMER_KEY,
  getTimer,
  elapsedMs,
  formatClock,
  start,
  pause,
  reset,
  setAttach,
  setGoal,
  setTimer,
} from "./lib/timer.js";

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

let entities = { tasks: [], clients: [] };

// ---- helpers --------------------------------------------------------------

function showError(msg) {
  $("timer-error").textContent = msg;
  $("timer-error").classList.remove("hidden");
}
function clearError() {
  $("timer-error").classList.add("hidden");
}
function showNotice(text) {
  $("notice-text").textContent = text;
  $("notice").classList.remove("hidden");
}
function hideNotice() {
  $("notice").classList.add("hidden");
}

// ---- entities (tasks / clients) via the bridge ----------------------------

async function loadEntities() {
  $("conn").textContent = "syncing…";
  let res;
  try {
    res = await send({ type: "GET_ENTITIES" });
  } catch {
    res = null;
  }

  if (res?.ok) {
    entities = { tasks: res.tasks, clients: res.clients };
    await chrome.storage.local.set({ wido_ext_entities: entities });
    hideNotice();
    $("conn").textContent = "";
  } else {
    const cached = (await chrome.storage.local.get("wido_ext_entities"))
      .wido_ext_entities;
    if (cached) entities = cached;
    $("conn").textContent = "offline";
    if (res?.reason === "NOT_SIGNED_IN") {
      showNotice("Sign in to Wido to pick a task or save time.");
    } else if (res?.message) {
      showNotice(res.message);
    }
  }
  populateAttachOptions();
}

function makeOption(value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

async function populateAttachOptions() {
  const sel = $("attach");
  const t = await getTimer();
  sel.innerHTML = '<option value="">No task (free timer)</option>';

  if (entities.tasks.length) {
    const g = document.createElement("optgroup");
    g.label = "Tasks";
    for (const task of entities.tasks)
      g.appendChild(makeOption(`task:${task.id}`, task.title));
    sel.appendChild(g);
  }
  if (entities.clients.length) {
    const g = document.createElement("optgroup");
    g.label = "Clients";
    for (const c of entities.clients)
      g.appendChild(makeOption(`client:${c.id}`, c.name));
    sel.appendChild(g);
  }
  sel.value = t.attach ? `${t.attach.type}:${t.attach.id}` : "";
}

// ---- timer view -----------------------------------------------------------

async function hydrate() {
  const t = await getTimer();
  $("goal").value = t.goalMs != null ? Math.round(t.goalMs / 60000) : "";
  $("alarm").checked = t.alarmEnabled;
  paint(t);
  send({ type: "SYNC" }).catch(() => {}); // pull latest from the web (if open)
  loadEntities(); // async — fills the dropdown when it returns
}

function paint(t) {
  const running = t.running;
  const hasTime = elapsedMs(t) > 0;
  $("clock").textContent = formatClock(elapsedMs(t));

  const controls = $("controls");
  controls.innerHTML = "";

  if (running) {
    controls.appendChild(btn("Pause", "pause", () => act(pause)));
  } else {
    controls.appendChild(
      btn(hasTime ? "Resume" : "Start", "go", () => act(start))
    );
  }
  if (hasTime) {
    if (t.attach) controls.appendChild(btn("Save", "save", onSave));
    controls.appendChild(btn("Discard", "danger", () => act(reset)));
  }

  $("timer-msg").textContent =
    !t.attach && hasTime
      ? "Free timer — assign a task or client to log this time."
      : "";
}

function btn(label, cls, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

async function act(fn) {
  await fn();
  paint(await getTimer());
}

async function onSave() {
  clearError();
  const t = await getTimer();
  const seconds = Math.round(elapsedMs(t) / 1000);
  const saveBtn = $("controls").querySelector(".save");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
  }
  let res;
  try {
    res = await send({ type: "SAVE_TIME", attach: t.attach, seconds });
  } catch {
    res = null;
  }

  if (res?.ok) {
    await reset();
    $("timer-msg").textContent = `Logged ${formatClock(seconds * 1000)}.`;
    paint(await getTimer());
  } else {
    if (res?.reason === "NOT_SIGNED_IN") {
      showNotice("Open Wido and sign in, then hit Save again.");
    } else {
      showError(res?.message || "Couldn't save — is Wido reachable?");
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }
}

// ---- inputs ---------------------------------------------------------------

$("attach").addEventListener("change", async (e) => {
  const v = e.target.value;
  if (!v) return setAttach(null, null);
  const [type, id] = v.split(":");
  const list = type === "task" ? entities.tasks : entities.clients;
  const item = list.find((x) => x.id === id);
  await setAttach({ type, id }, item ? item.title ?? item.name : null);
});

$("goal").addEventListener("change", async (e) => {
  const mins = parseInt(e.target.value, 10);
  await setGoal(Number.isFinite(mins) && mins > 0 ? mins * 60000 : null);
});

$("alarm").addEventListener("change", async (e) => {
  await setTimer({ alarmEnabled: e.target.checked });
});

$("open-wido").addEventListener("click", () => send({ type: "OPEN_WIDO" }));

// ---- create a task --------------------------------------------------------

$("new-task-toggle").addEventListener("click", () => {
  $("new-task-row").classList.toggle("hidden");
  if (!$("new-task-row").classList.contains("hidden")) $("new-task-title").focus();
});

$("new-task-title").addEventListener("keydown", (e) => {
  if (e.key === "Enter") createTask();
});
$("new-task-create").addEventListener("click", createTask);

async function createTask() {
  clearError();
  const title = $("new-task-title").value.trim();
  if (!title) return;
  const createBtn = $("new-task-create");
  createBtn.disabled = true;
  createBtn.textContent = "…";
  let res;
  try {
    res = await send({ type: "CREATE_TASK", title });
  } catch {
    res = null;
  }

  if (res?.ok) {
    entities.tasks = [res.task, ...entities.tasks];
    await chrome.storage.local.set({ wido_ext_entities: entities });
    populateAttachOptions();
    $("attach").value = `task:${res.task.id}`;
    await setAttach({ type: "task", id: res.task.id }, res.task.title);
    $("new-task-title").value = "";
    $("new-task-row").classList.add("hidden");
    $("timer-msg").textContent = `Created "${res.task.title}".`;
    paint(await getTimer());
  } else if (res?.reason === "NOT_SIGNED_IN") {
    showNotice("Open Wido and sign in to create a task.");
  } else {
    showError(res?.message || "Couldn't create the task.");
  }
  createBtn.disabled = false;
  createBtn.textContent = "Add";
}

// ---- live ticking + cross-surface sync ------------------------------------

setInterval(async () => {
  const t = await getTimer();
  if (t.running) $("clock").textContent = formatClock(elapsedMs(t));
}, 1000);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[TIMER_KEY]) getTimer().then(paint);
});

hydrate();
