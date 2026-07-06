# CLAUDE.md

Personal task tracker. One page, no login, local-first. Runs as **web / PWA / Tauri desktop** from one codebase. Philosophy: **simple > completo** — if in doubt about a feature, it doesn't go in.

## Commands

```bash
npm run dev          # Next dev server (localhost:3000)
npm run build        # static export -> ./out  (this is the prod build; deploys to Vercel as-is)
npm run icons        # regenerate PWA/Tauri icons from an SVG (scripts/generate-icons.mjs)
npm run tauri:dev    # desktop app, hot reload   (needs Rust: https://rustup.rs)
npm run tauri:build  # build Tasks.app/.dmg      (run `npm run tauri icon src-tauri/icons/icon-source.png` first)
```

No test suite. Verify by building + driving the UI.

## Structure

```
app/            layout.tsx, page.tsx (tasks), timer/page.tsx (pomodoro), globals.css, manifest.ts
components/     feature comps (task-*, *-filter, data-menu, theme-*, app-nav, client-manager,
                lottie-background) + ui/ (shadcn-style primitives incl. dialog)
hooks/          store.ts (shared external store) + use-tasks.ts / use-clients.ts (wrap the store)
lib/            types.ts, utils.ts, storage/ (adapter layer)
public/         icons, sw.js, pomodoro-lottie.json (extracted from the .lottie, loaded by path)
src-tauri/      Tauri desktop shell (Rust) + SQLite migrations
scripts/        generate-icons.mjs
```

## Pages & nav

Two real routes, switched by `AppNav` (Tasks / Timer): `/` (task list) and `/timer`.
- **Timer** = editable Pomodoro (presets 15/25/45/60, tap the clock to edit minutes). Start/Pause/Resume/Reset. Optionally "working on" a task → tracked focus seconds accumulate into `task.timeSpent` via `addTime`. While running the screen goes clean (nav/selector hidden) and `LottieBackground` loops behind. Timer prefs persist in localStorage `task-tracker-timer` (separate from the main store).
- **Clients** managed via a shared dialog behind `ClientManagerProvider` (context: `useClientManager().open()`). Triggers: `ClientManagerButton` (header) and a "Manage clients & colors…" item in the in-task client dropdown. Add/rename/recolor (native color input)/delete + logo upload (downscaled via `fileToLogoDataUrl`). Deleting a client clears it from referencing tasks.

## Time tracking model

`Task.timeEntries: TimeEntry[]` ({id, seconds, label?, createdAt, manual?}) is the source of truth; total via `taskTotalSeconds()`. Legacy `timeSpent` (number) is folded into one entry by `migrate()` in store.ts on hydrate. Timer sessions push non-manual entries (`addTime`); the task panel's Time section adds/edits/deletes blocks (`addManualTime`/`updateTimeEntry`/`deleteTimeEntry`). Persisted in SQLite as a JSON `timeEntries` TEXT column. The expanded task panel also has an editable **title** field (title edit was previously only the row's double-click).

## Key decisions (don't re-litigate)

- **Client-only, static export** (`output: 'export'` in next.config). No server components doing data, no API routes. Works for Vercel, PWA, and Tauri alike. `next start` won't serve it — use the export or `tauri`.
- **State**: single shared store in `hooks/store.ts` (subscribe/getState/setState via `useSyncExternalStore`). `useTasks`/`useClients` both read it, so they never fight over persistence. `addTask` prepends (newest on top, negative order).
- **Storage = adapter pattern** (`lib/storage/`): `StorageAdapter { load, save }`, chosen at runtime by `isTauri()`.
  - web/PWA → `localAdapter` (localStorage key `task-tracker-v1`)
  - desktop → `sqliteAdapter` (`tauri-plugin-sql`, file `tasks.db`; schema via Rust migrations in `src-tauri/src/lib.rs`)
  - **Data lives in different sandboxes per target.** The Backup menu (`data-menu.tsx`, DB icon in header) exports/imports JSON — the universal backup + the bridge between targets.
- **Future sync → Supabase** across all devices (settled). It becomes one more adapter (`supabaseAdapter`) + magic-link auth; the JSON data model stays. See memory `sync-path-supabase`. Keep new work compatible with this.
- **UI**: shadcn/ui-style primitives hand-authored in `components/ui/` (Radix under the hood). Tailwind v3 with HSL CSS-var tokens in globals.css. **Dark mode is default** (`next-themes`, class strategy). Client badges use inline styles from `client.color` (translucent tint + colored text).
- **Stack pins**: Next 15.x (`backport` tag, patched for CVE-2025-66478 — do NOT bump to 16 without intent). React 19. `@dnd-kit` for reorder.

## Conventions & gotchas

- Import alias `@/*` → repo root.
- SQLite: `order` is a reserved word — always quote as `"order"`. `completed` stored as INTEGER 0/1.
- `completedAt` powers the "done today" header count; optional, safe to ignore on migration.
- `needsReply` (bool) = "I owe someone a message/reply" flag (message icon on a row; "To reply" filter + header count). `replyTo`/`replyNote` hold who + what, edited in the expanded panel; `replyTo` shows as an amber pill on the row.
- `dueAt` (timestamp) = optional due date+time. Edited via native `datetime-local` in the panel; row shows a color-coded pill (overdue=red, <24h=amber, else muted) via `formatDue`/`dueUrgency` in lib/utils.
- Reorder persists positions of *visible* tasks only, so filtering never scrambles hidden ones (see `reorderTasks` in use-tasks).
- iOS PWA can evict localStorage after ~7 days idle → that's why Export/backup exists; real durability = Supabase sync.
- `sqliteAdapter` uses a **dynamic** `import('@tauri-apps/plugin-sql')` so the web bundle never loads it.

## Deploy

Vercel auto-detects Next + the `out/` export — zero config. Push to GitHub, import the repo. Tauri artifacts are built locally with `npm run tauri:build`.
