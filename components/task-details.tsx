"use client";

import * as React from "react";
import {
  CalendarClock,
  Check,
  Clock,
  MessageSquare,
  Plus,
  Settings2,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import {
  cn,
  formatDuration,
  fromDateTimeLocal,
  taskTotalSeconds,
  toDateTimeLocal,
} from "@/lib/utils";

import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/use-clients";
import { useTasks } from "@/hooks/use-tasks";
import { useClientManager } from "@/components/client-manager";
import type { Task, TimeEntry } from "@/lib/types";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/** Render plain text, turning URLs into clickable links. */
function renderDetails(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-500 underline underline-offset-2 hover:text-sky-400"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface TaskDetailsProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  onClose: () => void;
}

export function TaskDetails({ task, onUpdate, onClose }: TaskDetailsProps) {
  const { clients, addClient, getClient } = useClients();
  const { addManualTime, updateTimeEntry, deleteTimeEntry } = useTasks();
  const { open: openClientManager } = useClientManager();
  const [title, setTitle] = React.useState(task.title);
  const [details, setDetails] = React.useState(task.details ?? "");
  const [editing, setEditing] = React.useState(!task.details);
  const [newClient, setNewClient] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(task.replyTo ?? "");
  const [replyNote, setReplyNote] = React.useState(task.replyNote ?? "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Debounced auto-save while typing.
  React.useEffect(() => {
    if (details === (task.details ?? "")) return;
    const id = setTimeout(() => onUpdate({ details }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

  React.useEffect(() => {
    if (
      replyTo === (task.replyTo ?? "") &&
      replyNote === (task.replyNote ?? "")
    ) {
      return;
    }
    const id = setTimeout(
      () => onUpdate({ replyTo, replyNote }),
      400
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo, replyNote]);

  const toggleNeedsReply = () => onUpdate({ needsReply: !task.needsReply });

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) onUpdate({ title: trimmed });
    else setTitle(task.title);
  };

  const totalSeconds = taskTotalSeconds(task);
  const entries = task.timeEntries ?? [];

  const currentClient = getClient(task.client);

  const assignClient = (clientId: string | undefined) => {
    onUpdate({ client: clientId });
  };

  const createAndAssign = () => {
    const client = addClient(newClient);
    if (client) {
      assignClient(client.id);
      setNewClient("");
    }
  };

  return (
    <div className="mt-2 space-y-3 pl-[3.25rem] pr-2">
      {/* Editable title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setTitle(task.title);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Task title"
        className="w-full rounded-md bg-transparent text-sm font-semibold outline-none focus-visible:bg-accent focus-visible:px-2 focus-visible:py-1"
      />

      {editing ? (
        <Textarea
          ref={textareaRef}
          autoFocus
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          onBlur={() => {
            onUpdate({ details });
            if (details.trim()) setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onClose();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              onUpdate({ details });
              setEditing(false);
            }
          }}
          placeholder="Add details, links, notes…"
          className="text-sm"
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="cursor-text whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground"
        >
          {renderDetails(details)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Tag className="h-3.5 w-3.5" />
              {currentClient ? currentClient.name : "Assign client"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {clients.map((client) => (
              <DropdownMenuItem
                key={client.id}
                onSelect={() => assignClient(client.id)}
                className="justify-between"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                  {client.name}
                </span>
                {task.client === client.id && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
            {currentClient && (
              <DropdownMenuItem
                onSelect={() => assignClient(undefined)}
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

        <button
          onClick={toggleNeedsReply}
          aria-pressed={task.needsReply}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            task.needsReply
              ? "text-amber-500 hover:bg-amber-500/10"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {task.needsReply ? "To reply" : "Mark to reply"}
        </button>
      </div>

      {/* Due date + time */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Due
        </span>
        <input
          type="datetime-local"
          value={task.dueAt ? toDateTimeLocal(task.dueAt) : ""}
          onChange={(e) =>
            onUpdate({ dueAt: fromDateTimeLocal(e.target.value) })
          }
          className="rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
        />
        {task.dueAt && (
          <button
            onClick={() => onUpdate({ dueAt: undefined })}
            aria-label="Clear due date"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {task.needsReply && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <input
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            onBlur={() => onUpdate({ replyTo, replyNote })}
            placeholder="To whom? (e.g. Garrett)"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          <textarea
            value={replyNote}
            onChange={(e) => setReplyNote(e.target.value)}
            onBlur={() => onUpdate({ replyTo, replyNote })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="What do you need to say / reply?"
            rows={2}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Time tracking */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Time
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {totalSeconds > 0 ? formatDuration(totalSeconds) : "—"}
          </span>
        </div>

        {entries.length > 0 && (
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                entry={entry}
                onChange={(u) => updateTimeEntry(task.id, entry.id, u)}
                onDelete={() => deleteTimeEntry(task.id, entry.id)}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => addManualTime(task.id, 25 * 60, "")}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add time block
        </button>
      </div>
    </div>
  );
}

function TimeEntryRow({
  entry,
  onChange,
  onDelete,
}: {
  entry: TimeEntry;
  onChange: (u: { seconds?: number; label?: string }) => void;
  onDelete: () => void;
}) {
  const [minutes, setMinutes] = React.useState(
    String(Math.round(entry.seconds / 60))
  );
  const [label, setLabel] = React.useState(entry.label ?? "");

  const commitMinutes = () => {
    const n = parseFloat(minutes.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) onChange({ seconds: Math.round(n * 60) });
    else setMinutes(String(Math.round(entry.seconds / 60)));
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={minutes}
        inputMode="decimal"
        onChange={(e) => setMinutes(e.target.value.replace(/[^0-9.,]/g, ""))}
        onBlur={commitMinutes}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-14 rounded-md border border-input bg-transparent px-2 py-1 text-sm tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <span className="text-xs text-muted-foreground">min</span>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => onChange({ label: label.trim() || undefined })}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={entry.manual ? "Note (optional)" : "Focus session"}
        className="h-8 flex-1 rounded-md bg-transparent px-2 text-sm outline-none focus-visible:bg-accent"
      />
      <button
        onClick={onDelete}
        aria-label="Delete time block"
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
