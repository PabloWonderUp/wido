# Wido — what you're working on

A minimal personal task tracker.

A single-page, no-login checklist. Runs as a **website**, an **installable PWA**, and a
**native desktop app** (Tauri) — from one codebase.

## Stack

- Next.js 15 (App Router, static export) · TypeScript · Tailwind CSS
- shadcn/ui-style primitives · `@dnd-kit` drag & drop · `lucide-react` icons
- `next-themes` (dark mode, dark by default)
- Storage adapters: **localStorage** (web/PWA) · **SQLite** (desktop, via `tauri-plugin-sql`)

## Where your data lives

| Target        | Backend                         | Durability |
|---------------|---------------------------------|------------|
| Web / PWA     | `localStorage` (`task-tracker-v1`) | Per-origin; survives reloads. Use **Export** for real backups. |
| Desktop (Tauri) | SQLite file `tasks.db` in the app-config dir | Durable file on disk; survives updates; back it up as a file. |

The **Backup menu** (database icon in the header) exports/imports a JSON snapshot — your
universal safety net, and the way to move data from the browser into the desktop app
(their storages are separate sandboxes).

The storage layer is an adapter (`lib/storage/`), so adding remote sync later (e.g.
Supabase) means writing one more adapter — the data model doesn't change.

## Run locally (web)

```bash
npm install
npm run dev      # http://localhost:3002 (fixed port; frees it first so it never bounces)
npm run build    # static export -> ./out  (deploys to Vercel as-is)
```

## PWA (install from the browser)

`npm run build` emits `manifest.webmanifest`, icons, and a service worker (`public/sw.js`).
Open the deployed URL in Chrome/Edge/Safari → **Install app** / **Add to Home Screen**.
Runs in its own window, offline-capable. Icons are generated with `npm run icons`.

## Desktop app (Tauri + SQLite)

Prerequisites (one-time):

1. Install **Rust**: <https://rustup.rs> (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
2. macOS: Xcode Command Line Tools (`xcode-select --install`)
3. Generate the platform icons from the 1024px source:
   ```bash
   npm run tauri icon src-tauri/icons/icon-source.png
   ```

Then:

```bash
npm run tauri:dev     # dev app with hot reload
npm run tauri:build   # produces Tasks.app / Tasks.dmg (or .msi/.exe on Windows)
```

The SQLite schema is created by Rust migrations in `src-tauri/src/lib.rs`; the TS side
reads/writes rows in `lib/storage/sqlite.ts`.

## Mobile (Android / iOS)

- **PWA** works today on both: Android (Chrome) is excellent; iOS (Safari) works via
  "Add to Home Screen" but can evict local storage after periods of disuse — so **Export
  backups** or add sync for anything you can't afford to lose.
- **Tauri mobile** can target native Android/iOS from this same project
  (`npm run tauri android init` / `ios init`), with durable SQLite. Requires Android
  Studio (SDK/NDK) and/or Xcode + an Apple Developer account for iOS devices.

## Data model

```ts
interface Task {
  id: string; title: string; details?: string; client?: string;
  completed: boolean; order: number; createdAt: number; completedAt?: number;
}
interface Client { id: string; name: string; color: string; }
interface AppState { tasks: Task[]; clients: Client[]; }
```
