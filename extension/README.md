# Wido Timer — Chrome extension

A count-up **stopwatch** for [Wido](../). Start / pause / resume / discard time,
assign it to a **task or client**, and save it straight into your Wido data.
Timer state is shared across every tab and window, and the toolbar badge shows
elapsed minutes while it runs.

## How it connects (no login, no setup)

The extension has **no separate login**. It piggybacks on your already-signed-in
Wido web app: it reads the current Supabase session from an open Wido tab (via
`chrome.scripting`, so it works on tabs that were already open — no reload) and
uses it to read/write your data.

- If a Wido tab is open, it uses it silently.
- If none is open, it **opens Wido in a background tab, grabs the session, and
  closes it** — you barely see it.
- The access token is **cached (~1h)**, so most actions need no tab at all; only
  when it expires does it briefly open one again.
- It only ever reads the **access token** (never the refresh token), so it can't
  desync or log you out of the web app.

The only thing to set: open `config.js` and point **`WIDO_OPEN_URL`** at your
Wido URL (e.g. your `*.vercel.app` production URL). That's the page it opens when
it needs your session and none is open.

> If your Wido URL changes, update it in three places: `WIDO_OPEN_URL` in
> `config.js`, `host_permissions` in `manifest.json`, and `WIDO_MATCH` in
> `background.js`.

## Load it in Chrome

1. Go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Pin the "Wido Timer" icon and click it.

To update after code changes, hit the ↻ reload button on the extension card.

## Using it

- **Start / Pause / Resume / Discard** the stopwatch — all local, works offline.
- **Working on**: pick a task or client. On **Save**, the elapsed time is
  appended as a `TimeEntry` (`label: "Stopwatch"`) to that task/client — exactly
  like the in-app global stopwatch — so it shows up in the task's tracked time
  and in **Hours**. No pick = free timer (Save hidden).
- If you're not signed in to Wido, the popup shows a note with an **Open Wido**
  button. Sign in once there; the extension caches the session afterward.

## Notes / limits

- Requires being **signed in to Wido** (Supabase cloud). Local "offline mode"
  data isn't in Supabase, so the extension can't reach it.
- The toolbar **badge shows minutes**, not seconds (the MV3 service worker gets
  suspended, so a per-second badge isn't reliable). The popup shows live `mm:ss`.
- **Save is conflict-safe**: it re-reads the latest cloud state, appends only to
  the target's `timeEntries`, and upserts — it won't clobber web edits.
