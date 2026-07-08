"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Check, Link2, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotes } from "@/hooks/use-notes";
import { useTasks } from "@/hooks/use-tasks";

/** True when a note has no title and no visible body/image. */
// Lazy-load the heavy rich-text editor only when a note is actually opened.
const NoteEditor = dynamic(
  () => import("@/components/note-editor").then((m) => m.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[240px] animate-pulse rounded-lg border border-input" />
    ),
  }
);

function isEmptyNote(title: string | undefined, content: string): boolean {
  if (title?.trim()) return false;
  if (/<img/i.test(content)) return false;
  return content.replace(/<[^>]*>/g, "").trim() === "";
}

type OpenOpts = { noteId?: string; taskId?: string };

const NoteDialogContext = React.createContext<{
  open: (opts?: OpenOpts) => void;
} | null>(null);

export function useNoteDialog() {
  const ctx = React.useContext(NoteDialogContext);
  if (!ctx) throw new Error("useNoteDialog must be used within provider");
  return ctx;
}

export function NoteDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { addNote } = useNotes();
  const [noteId, setNoteId] = React.useState<string | null>(null);
  const [isNew, setIsNew] = React.useState(false);

  const open = React.useCallback(
    (opts?: OpenOpts) => {
      if (opts?.noteId) {
        setIsNew(false);
        setNoteId(opts.noteId);
      } else {
        const id = addNote({ taskId: opts?.taskId });
        setIsNew(true);
        setNoteId(id);
      }
    },
    [addNote]
  );

  const value = React.useMemo(() => ({ open }), [open]);

  return (
    <NoteDialogContext.Provider value={value}>
      {children}
      {noteId && (
        <NoteDialog
          noteId={noteId}
          isNew={isNew}
          onClose={() => setNoteId(null)}
        />
      )}
    </NoteDialogContext.Provider>
  );
}

function NoteDialog({
  noteId,
  isNew,
  onClose,
}: {
  noteId: string;
  isNew: boolean;
  onClose: () => void;
}) {
  const { getNote, updateNote, deleteNote } = useNotes();
  const { tasks, getTask } = useTasks();
  const note = getNote(noteId);

  const linkedTask = note?.taskId ? getTask(note.taskId) : undefined;

  const handleOpenChange = (v: boolean) => {
    if (v) return;
    // Discard an untouched brand-new note on close.
    if (isNew && note && isEmptyNote(note.title, note.content)) {
      deleteNote(noteId);
    }
    onClose();
  };

  if (!note) return null;

  const activeTasks = tasks.filter((t) => !t.archived);

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Note</DialogTitle>
        </DialogHeader>

        <input
          value={note.title ?? ""}
          onChange={(e) => updateNote(noteId, { title: e.target.value })}
          placeholder="Untitled note"
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
        />

        {/* Link to a task */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  linkedTask
                    ? "bg-sky-500/15 text-sky-500 hover:bg-sky-500/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                {linkedTask ? linkedTask.title : "Personal note"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
              <DropdownMenuItem
                onSelect={() => updateNote(noteId, { taskId: undefined })}
                className="justify-between"
              >
                Personal (no task)
                {!note.taskId && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
              {activeTasks.length > 0 && <DropdownMenuSeparator />}
              {activeTasks.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => updateNote(noteId, { taskId: t.id })}
                  className="justify-between gap-2"
                >
                  <span className="truncate">{t.title}</span>
                  {note.taskId === t.id && (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <NoteEditor
          key={noteId}
          content={note.content}
          onChange={(html) => updateNote(noteId, { content: html })}
        />

        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm("Delete this note?")) {
                deleteNote(noteId);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={() => handleOpenChange(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
