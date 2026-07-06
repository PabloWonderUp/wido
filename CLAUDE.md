# CLAUDE.md

**Wido** ("what I'm doing") — personal task tracker. One page, local-first. Runs as **web / PWA / Tauri desktop** from one codebase. Philosophy: **simple > completo** — if in doubt about a feature, it doesn't go in.

## Commands

```bash
npm run dev          # Next dev server — ALWAYS localhost:3002 (scripts/dev.mjs frees the port first so it never bounces; localStorage is per-origin, so a stable port keeps data in one place)
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
- **Timer** = editable Pomodoro with **work + break cycle** (Focus/Break phases auto-alternate). Both durations have presets + a custom number input (`DurationRow`); tapping the clock edits the current phase. Start/Pause/Resume/Reset. Optionally "working on" a task → only **focus** seconds accumulate into the task via `addTime`. While running the screen goes clean and `LottieBackground` loops behind; a phase pill shows Focus/Break. Prefs (`workMin`,`breakMin`,`taskId`) persist in localStorage `task-tracker-timer`.
- **Clients** managed via a shared dialog behind `ClientManagerProvider` (context: `useClientManager().open()`). Triggers: `ClientManagerButton` (header) and a "Manage clients & colors…" item in the in-task client dropdown. Add/rename/recolor (native color input)/delete + logo upload (downscaled via `fileToLogoDataUrl`). Deleting a client clears it from referencing tasks.

## Views, sort, projects

- **Statuses**: `Task.status: TaskStatus` ("todo"|"in_progress"|"blocked"|"done"), source of truth; `completed` kept in sync (=== "done"). `statusOf()` + `STATUS_META` (labels/colors) in lib/status.ts. Set via panel picker, board drag (`setStatus`), or the row checkbox (todo↔done). Legacy tasks migrated from `completed` on load. List status-filter chips = All + 4 statuses.
- **List / Board** view toggle (persisted in localStorage `task-tracker-view` with sort + groupBy). List width `max-w-2xl`, board `max-w-6xl`.
- **List sort** (`SortMode`): Manual (drag order — DnD only enabled here via `dndDisabled` on TaskList/TaskItem), Client (by client name, unassigned last), Due date (ascending, no-due last).
- **Board** (`components/board-view.tsx`): group by Status (To Do/Done) or Client (column per client + "No client"). @dnd-kit multi-container; dragging a card to another column reassigns the field (`onSetCompleted`/`onSetClient`) and `onReorder` rebuilds the global order from the columns. Cards toggle done + open the task in list view. Board shows all tasks (list filters don't apply).
- **Project tasks**: `Task.isProject` + `Task.subtasks: SubTask[]` (checklist). Toggle "Make project" in the panel reveals the subtask checklist (add/toggle/edit/delete via use-tasks `addSubtask`/`toggleSubtask`/`updateSubtask`/`deleteSubtask`). Row + card show a violet progress pill (done/total). Persisted in SQLite as `isProject` + `subtasks` JSON.

## Time tracking model

`Task.timeEntries: TimeEntry[]` ({id, seconds, label?, createdAt, manual?}) is the source of truth; total via `taskTotalSeconds()`. Legacy `timeSpent` (number) is folded into one entry by `migrate()` in store.ts on hydrate. Timer sessions push non-manual entries (`addTime`); the task panel's Time section adds/edits/deletes blocks (`addManualTime`/`updateTimeEntry`/`deleteTimeEntry`). Persisted in SQLite as a JSON `timeEntries` TEXT column. The expanded task panel also has an editable **title** field (title edit was previously only the row's double-click).

## Key decisions (don't re-litigate)

- **Client-only, static export** (`output: 'export'` in next.config). No server components doing data, no API routes. Works for Vercel, PWA, and Tauri alike. `next start` won't serve it — use the export or `tauri`.
- **State**: single shared store in `hooks/store.ts` (subscribe/getState/setState via `useSyncExternalStore`). `useTasks`/`useClients` both read it, so they never fight over persistence. `addTask` prepends (newest on top, negative order).
- **Storage = adapter pattern** (`lib/storage/`): `StorageAdapter { load, save }`, chosen at runtime by `isTauri()`.
  - web/PWA → `localAdapter` (localStorage key `task-tracker-v1`)
  - desktop → `sqliteAdapter` (`tauri-plugin-sql`, file `tasks.db`; schema via Rust migrations in `src-tauri/src/lib.rs`)
  - signed in (Supabase) → `supabaseAdapter` (one `app_state` jsonb row per user; wins over local/sqlite via `getActiveUser()`). Auth via `useAuth`/`lib/supabase.ts` (env-gated: `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`). `components/auth-sync.tsx` switches backend on login/logout and seeds cloud from local on first login. Login optional; see memory `sync-path-supabase`.
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
