"use client";

import * as React from "react";
import { Link2, NotebookPen, Plus, User } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { useNoteDialog } from "@/components/note-dialog";
import { useNotes } from "@/hooks/use-notes";
import { useTasks } from "@/hooks/use-tasks";
import type { Note } from "@/lib/types";

type Filter = "all" | "personal" | "linked";

function plainSnippet(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : null;
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotesPage() {
  const { notes, hydrated } = useNotes();
  const { getTask } = useTasks();
  const { open } = useNoteDialog();
  const [filter, setFilter] = React.useState<Filter>("all");

  const shown = notes.filter((n) =>
    filter === "all"
      ? true
      : filter === "personal"
      ? !n.taskId
      : !!n.taskId
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <AppNav />
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <button
          onClick={() => open()}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New note
        </button>
      </header>

      <div className="mt-5 inline-flex items-center gap-1 rounded-full bg-muted p-1">
        {(["all", "personal", "linked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors " +
              (filter === f
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {!hydrated ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <NotebookPen className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No notes yet. Hit{" "}
              <span className="font-medium text-foreground">New note</span> to
              jot something down.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shown.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                taskTitle={
                  note.taskId ? getTask(note.taskId)?.title : undefined
                }
                onOpen={() => open({ noteId: note.id })}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function NoteCard({
  note,
  taskTitle,
  onOpen,
}: {
  note: Note;
  taskTitle?: string;
  onOpen: () => void;
}) {
  const img = firstImage(note.content);
  const snippet = plainSnippet(note.content);

  return (
    <button
      onClick={onOpen}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-colors hover:border-foreground/20"
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-28 w-full object-cover" />
      )}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <span className="truncate font-semibold">
          {note.title?.trim() || "Untitled note"}
        </span>
        {snippet && (
          <span className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {snippet}
          </span>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={
              "inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
              (taskTitle
                ? "bg-sky-500/15 text-sky-500"
                : "bg-muted text-muted-foreground")
            }
          >
            {taskTitle ? (
              <>
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{taskTitle}</span>
              </>
            ) : (
              <>
                <User className="h-3 w-3 shrink-0" />
                Personal
              </>
            )}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatWhen(note.updatedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
