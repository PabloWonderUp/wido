"use client";

import * as React from "react";
import { Check, Clock3, MessageSquare, Timer, X } from "lucide-react";

import {
  cn,
  formatReplyRemaining,
  fromDateTimeLocal,
  REPLY_URGENCY_COLOR,
  replyUrgency,
  toDateTimeLocal,
} from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client, Task } from "@/lib/types";

const NONE = "__none__";

/** Quick presets for "how long do I have to reply". */
const REPLY_PRESETS: { label: string; ms: number }[] = [
  { label: "30 min", ms: 30 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "2 hours", ms: 2 * 60 * 60_000 },
  { label: "4 hours", ms: 4 * 60 * 60_000 },
  { label: "Tomorrow", ms: 24 * 60 * 60_000 },
];

interface ReplyPanelProps {
  tasks: Task[];
  getClient: (id?: string) => Client | undefined;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onOpen: (id: string) => void;
  className?: string;
}

/**
 * Side panel listing the messages I still owe a reply to, grouped by client.
 * Each item can carry a reply deadline whose dot/label shifts green→amber→red
 * as the window elapses. Re-renders on a timer so the color updates live.
 */
export function ReplyPanel({
  tasks,
  getClient,
  onUpdate,
  onOpen,
  className,
}: ReplyPanelProps) {
  // Tick every 30s so the urgency colors advance without a user action.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const items = tasks.filter(
    (t) => t.needsReply && !t.completed && !t.archived
  );

  // Group by client, unassigned last. Preserve task order within a group.
  const groups = React.useMemo(() => {
    const byClient = new Map<string, Task[]>();
    for (const t of items) {
      const key = t.client ?? NONE;
      const arr = byClient.get(key);
      if (arr) arr.push(t);
      else byClient.set(key, [t]);
    }
    const entries = Array.from(byClient.entries());
    entries.sort(([a], [b]) => {
      if (a === NONE) return 1;
      if (b === NONE) return -1;
      const an = getClient(a)?.name ?? "";
      const bn = getClient(b)?.name ?? "";
      return an.localeCompare(bn);
    });
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, getClient]);

  return (
    <aside
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-amber-500" />
          To reply
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div className="space-y-4">
        {groups.map(([clientId, groupTasks]) => {
          const client = clientId === NONE ? undefined : getClient(clientId);
          return (
            <div key={clientId}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: client?.color ?? "#94A3B8" }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {client?.name ?? "No client"}
                </span>
              </div>
              <div className="space-y-2">
                {groupTasks.map((t) => (
                  <ReplyItem
                    key={t.id}
                    task={t}
                    onUpdate={(u) => onUpdate(t.id, u)}
                    onOpen={() => onOpen(t.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ReplyItem({
  task,
  onUpdate,
  onOpen,
}: {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  onOpen: () => void;
}) {
  const [showFull, setShowFull] = React.useState(false);
  const noteRef = React.useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = React.useState(false);

  // Detect whether the (collapsed) note is actually being cut off, so we only
  // show a "Show more" affordance when there's something hidden.
  React.useEffect(() => {
    const el = noteRef.current;
    if (el && !showFull) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [task.replyNote, showFull]);

  const hasReplyTo = !!task.replyTo?.trim();
  const hasDeadline = !!task.replyDueAt && !!task.replySetAt;
  const urgency = hasDeadline
    ? replyUrgency(task.replySetAt!, task.replyDueAt!)
    : null;
  const color = urgency ? REPLY_URGENCY_COLOR[urgency] : undefined;

  const setDeadline = (ms: number) => {
    const now = Date.now();
    onUpdate({ replySetAt: now, replyDueAt: now + ms });
  };
  const setCustom = (value: string) => {
    const due = fromDateTimeLocal(value);
    onUpdate({ replySetAt: Date.now(), replyDueAt: due });
  };
  const clearDeadline = () =>
    onUpdate({ replyDueAt: undefined, replySetAt: undefined });
  const markReplied = () =>
    onUpdate({ needsReply: false, replyDueAt: undefined, replySetAt: undefined });

  return (
    <div
      className="rounded-lg border border-border bg-background/40 p-2.5"
      style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        {hasReplyTo ? (
          <span className="min-w-0 truncate text-sm font-medium">
            {task.replyTo!.trim()}
          </span>
        ) : (
          <button
            onClick={onOpen}
            className="min-w-0 truncate text-left text-sm font-medium hover:underline"
            title={task.title}
          >
            {task.title}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Deadline picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Set reply time"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Timer className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {REPLY_PRESETS.map((p) => (
                <DropdownMenuItem key={p.label} onSelect={() => setDeadline(p.ms)}>
                  {p.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="p-1">
                <input
                  type="datetime-local"
                  value={task.replyDueAt ? toDateTimeLocal(task.replyDueAt) : ""}
                  onChange={(e) => setCustom(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-sm border border-input bg-transparent px-1.5 py-1 text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              {hasDeadline && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={clearDeadline}
                    className="text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Clear deadline
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mark replied */}
          <button
            onClick={markReplied}
            aria-label="Mark replied"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-green-500/10 hover:text-green-500"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {task.replyNote?.trim() && (
        <>
          <p
            ref={noteRef}
            onClick={() => (clamped || showFull) && setShowFull((v) => !v)}
            className={cn(
              "mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground",
              !showFull && "line-clamp-3",
              (clamped || showFull) && "cursor-pointer"
            )}
          >
            {task.replyNote}
          </p>
          {(clamped || showFull) && (
            <button
              onClick={() => setShowFull((v) => !v)}
              className="mt-0.5 text-xs font-medium text-sky-500 hover:underline"
            >
              {showFull ? "Show less" : "Show more"}
            </button>
          )}
        </>
      )}

      {hasReplyTo && (
        <button
          onClick={onOpen}
          className="mt-1.5 block max-w-full truncate text-left text-xs text-sky-500 hover:underline"
          title={task.title}
        >
          ↳ {task.title}
        </button>
      )}

      {hasDeadline && (
        <div
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium"
          style={{ color }}
        >
          <Clock3 className="h-3 w-3" />
          {formatReplyRemaining(task.replyDueAt!)}
        </div>
      )}
    </div>
  );
}
