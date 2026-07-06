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
app/            layout.tsx, page.tsx (the whole app), globals.css, manifest.ts
components/     feature comps (task-*, *-filter, data-menu, theme-*) + ui/ (shadcn-style primitives)
hooks/          store.ts (shared external store) + use-tasks.ts / use-clients.ts (wrap the store)
lib/            types.ts, utils.ts, storage/ (adapter layer)
src-tauri/      Tauri desktop shell (Rust) + SQLite migrations
scripts/        generate-icons.mjs
```

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
- Reorder persists positions of *visible* tasks only, so filtering never scrambles hidden ones (see `reorderTasks` in use-tasks).
- iOS PWA can evict localStorage after ~7 days idle → that's why Export/backup exists; real durability = Supabase sync.
- `sqliteAdapter` uses a **dynamic** `import('@tauri-apps/plugin-sql')` so the web bundle never loads it.

## Deploy

Vercel auto-detects Next + the `out/` export — zero config. Push to GitHub, import the repo. Tauri artifacts are built locally with `npm run tauri:build`.
