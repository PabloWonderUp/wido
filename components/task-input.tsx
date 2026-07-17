"use client";

import * as React from "react";
import {
  Plus,
  Tag,
  Check,
  X,
  Settings2,
  StickyNote,
  FolderKanban,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/use-clients";
import { useNotes } from "@/hooks/use-notes";
import { useClientManager } from "@/components/client-manager";

interface TaskInputProps {
  /** Create the task and return its id (so we can attach a linked note). */
  onAdd: (
    title: string,
    opts?: { client?: string; isProject?: boolean }
  ) => string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/** Escape plain text and wrap it as HTML paragraphs for the rich-text note. */
function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function TaskInput({ onAdd, inputRef }: TaskInputProps) {
  const { clients, addClient, getClient } = useClients();
  const { addNote } = useNotes();
  const { open: openClientManager } = useClientManager();

  const [value, setValue] = React.useState("");
  const [client, setClient] = React.useState<string | undefined>(undefined);
  const [isProject, setIsProject] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [newClient, setNewClient] = React.useState("");

  const currentClient = getClient(client);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const id = onAdd(trimmed, { client, isProject });
    const note = noteText.trim();
    if (id && note) addNote({ taskId: id, content: textToHtml(note) });
    // Reset the task fields; keep the selected client sticky for quick batch entry.
    setValue("");
    setIsProject(false);
    setNoteOpen(false);
    setNoteText("");
  };

  const createAndAssign = () => {
    const created = addClient(newClient);
    if (created) {
      setClient(created.id);
      setNewClient("");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-colors focus-within:border-muted-foreground/40">
      <div className="flex items-center gap-3">
        <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a task…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={!value.trim()}
          className="shrink-0"
        >
          Add
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/* Client */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                currentClient
                  ? "text-foreground hover:bg-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {currentClient ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: currentClient.color }}
                />
              ) : (
                <Tag className="h-3.5 w-3.5" />
              )}
              {currentClient ? currentClient.name : "Client"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {clients.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => setClient(c.id)}
                className="justify-between"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </span>
                {client === c.id && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
            {currentClient && (
              <DropdownMenuItem
                onSelect={() => setClient(undefined)}
                className="text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" /> Remove client
              </DropdownMenuItem>
            )}
            {clients.length > 0 && <DropdownMenuSeparator />}
            <div className="p-1">
              <input
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") createAndAssign();
                }}
                placeholder="New client…"
                className="w-full rounded-sm bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => openClientManager()}
              className="text-muted-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Manage clients & colors…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Note */}
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          aria-pressed={noteOpen || !!noteText.trim()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            noteOpen || noteText.trim()
              ? "text-foreground hover:bg-accent"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Note
        </button>

        {/* Project */}
        <button
          type="button"
          onClick={() => setIsProject((v) => !v)}
          aria-pressed={isProject}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            isProject
              ? "text-violet-500 hover:bg-violet-500/10"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <FolderKanban className="h-3.5 w-3.5" />
          Project
        </button>
      </div>

      {noteOpen && (
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Write a note for this task…"
          rows={3}
          className="mt-2 text-sm"
        />
      )}
    </div>
  );
}
