"use client";

import * as React from "react";
import { Check, Tag, X } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/use-clients";
import type { Task } from "@/lib/types";

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
  const [details, setDetails] = React.useState(task.details ?? "");
  const [editing, setEditing] = React.useState(!task.details);
  const [newClient, setNewClient] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Debounced auto-save while typing.
  React.useEffect(() => {
    if (details === (task.details ?? "")) return;
    const id = setTimeout(() => onUpdate({ details }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
