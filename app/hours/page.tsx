"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";

import {
  cn,
  clientMonthSeconds,
  entriesMonthSeconds,
  formatHours,
  formatMoney,
} from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import { useTasks } from "@/hooks/use-tasks";
import { useClients } from "@/hooks/use-clients";
import type { Client, TimeEntry } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** yyyy-mm-dd (local) at noon -> timestamp; noon dodges timezone day-shifts. */
const dayToTs = (day: string) => new Date(`${day}T12:00:00`).getTime();
/** Seconds -> a clean hours string, e.g. 5400 -> "1.5". */
const secsToHoursStr = (s: number) => String(+(s / 3600).toFixed(2));

const MASK = "•••";
const HIDE_KEY = "wido-hide-amounts";

export default function HoursPage() {
  const { tasks, hydrated } = useTasks();
  const { clients, addClientTime, updateClientTime, deleteClientTime } =
    useClients();

  // Current month offset: 0 = this month, -1 = last month, …
  const [offset, setOffset] = React.useState(0);

  // Hide money amounts (persisted) — for screen-sharing / privacy.
  const [hideAmounts, setHideAmounts] = React.useState(false);
  React.useEffect(() => {
    try {
      setHideAmounts(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleHide = () =>
    setHideAmounts((v) => {
      const next = !v;
      try {
        localStorage.setItem(HIDE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  const money = (v: number) => (hideAmounts ? `$${MASK}` : formatMoney(v));

  const base = new Date();
  const viewed = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = viewed.getFullYear();
  const monthIndex = viewed.getMonth();
  const monthLabel = viewed.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Date range for the pickers: constrained to the viewed month.
  const minDay = ymd(new Date(year, monthIndex, 1));
  const maxDay = ymd(new Date(year, monthIndex + 1, 0));
  const defaultDay = offset === 0 ? ymd(base) : minDay;

  // Pacing helper only makes sense for the current, still-running month.
  const isCurrentMonth = offset === 0;
  const daysLeft = isCurrentMonth
    ? new Date(year, monthIndex + 1, 0).getDate() - base.getDate() + 1
    : 0;

  const freelanceClients = clients.filter((c) => c.hourTracking);

  const rows = freelanceClients.map((c) => {
    const taskSeconds = clientMonthSeconds(tasks, c.id, year, monthIndex);
    const directEntries = (c.timeEntries ?? [])
      .filter((e) => {
        const d = new Date(e.createdAt);
        return d.getFullYear() === year && d.getMonth() === monthIndex;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    const directSeconds = entriesMonthSeconds(c.timeEntries, year, monthIndex);
    const seconds = taskSeconds + directSeconds;
    const hours = seconds / 3600;
    const target = c.monthlyHoursTarget ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((hours / target) * 100)) : 0;
    const rate = c.hourlyRate ?? 0;
    const amount = hours * rate;
    return { client: c, seconds, directEntries, hours, target, pct, rate, amount };
  });

  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0);
  const totalMoney = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <AppNav />
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatHours(totalSeconds)} tracked this month
            {totalMoney > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {money(totalMoney)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleHide}
            aria-label={hideAmounts ? "Show amounts" : "Hide amounts"}
            aria-pressed={hideAmounts}
            title={hideAmounts ? "Show amounts" : "Hide amounts"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {hideAmounts ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          {/* Month selector */}
          <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-medium capitalize">
            {monthLabel}
          </span>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            aria-label="Next month"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          </div>
        </div>
      </header>

      <div className="mt-6 space-y-3">
        {!hydrated ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : freelanceClients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No freelance clients yet. Open{" "}
              <span className="font-medium text-foreground">Clients</span> (the
              people icon) and turn on{" "}
              <span className="font-medium text-foreground">Hour tracking</span>{" "}
              for a client.
            </p>
          </div>
        ) : (
          rows.map((row) => (
            <ClientHoursCard
              key={row.client.id}
              {...row}
              defaultDay={defaultDay}
              minDay={minDay}
              maxDay={maxDay}
              isCurrentMonth={isCurrentMonth}
              daysLeft={daysLeft}
              hideAmounts={hideAmounts}
              onAddHours={(secs, note, createdAt) =>
                addClientTime(row.client.id, secs, note, createdAt)
              }
              onUpdateEntry={(entryId, updates) =>
                updateClientTime(row.client.id, entryId, updates)
              }
              onDeleteEntry={(entryId) =>
                deleteClientTime(row.client.id, entryId)
              }
            />
          ))
        )}
      </div>
    </main>
  );
}

function ClientHoursCard({
  client,
  seconds,
  directEntries,
  hours,
  target,
  pct,
  rate,
  amount,
  defaultDay,
  minDay,
  maxDay,
  isCurrentMonth,
  daysLeft,
  hideAmounts,
  onAddHours,
  onUpdateEntry,
  onDeleteEntry,
}: {
  client: Client;
  seconds: number;
  directEntries: TimeEntry[];
  hours: number;
  target: number;
  pct: number;
  rate: number;
  amount: number;
  defaultDay: string;
  minDay: string;
  maxDay: string;
  isCurrentMonth: boolean;
  daysLeft: number;
  hideAmounts: boolean;
  onAddHours: (seconds: number, note: string, createdAt: number) => void;
  onUpdateEntry: (
    entryId: string,
    updates: { seconds?: number; label?: string; createdAt?: number }
  ) => void;
  onDeleteEntry: (entryId: string) => void;
}) {
  const [hoursDraft, setHoursDraft] = React.useState("");
  const [noteDraft, setNoteDraft] = React.useState("");
  const [dayDraft, setDayDraft] = React.useState(defaultDay);

  // Keep the day in step with the viewed month.
  React.useEffect(() => {
    setDayDraft(defaultDay);
  }, [defaultDay]);

  const addHours = () => {
    const h = parseFloat(hoursDraft.replace(",", "."));
    if (Number.isNaN(h) || h <= 0) return;
    const createdAt = dayToTs(dayDraft || defaultDay);
    onAddHours(
      Math.round(h * 3600),
      noteDraft,
      Number.isNaN(createdAt) ? Date.now() : createdAt
    );
    setHoursDraft("");
    setNoteDraft("");
    setDayDraft(defaultDay);
  };

  // Pace needed to still hit the monthly goal, given what's left.
  const remaining = Math.max(0, target - hours);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const perDay = daysLeft > 0 ? remaining / daysLeft : 0;
  const perWeek = remaining / weeksLeft;
  const showPace = target > 0 && isCurrentMonth && hours < target && daysLeft > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: client.color }}
            />
          )}
          <span className="truncate font-semibold">{client.name}</span>
        </span>
        <span className="shrink-0 text-right text-sm tabular-nums">
          <span className="block">
            <span className="font-semibold">{formatHours(seconds)}</span>
            {target > 0 && (
              <span className="text-muted-foreground"> / {target}h</span>
            )}
          </span>
          {rate > 0 && (
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-green-500">
                {hideAmounts ? `$${MASK}` : formatMoney(amount)}
              </span>{" "}
              @ ${hideAmounts ? MASK : rate}/h
            </span>
          )}
        </span>
      </div>

      {target > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{pct}% of goal</span>
            <span>
              {hours > target
                ? `+${(hours - target).toFixed(1)}h over`
                : `${(target - hours).toFixed(1)}h left`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                hours >= target ? "bg-green-500" : ""
              )}
              style={{
                width: `${pct}%`,
                backgroundColor: hours >= target ? undefined : client.color,
              }}
            />
          </div>
        </div>
      )}

      {showPace && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          <span>To hit the goal:</span>
          <span className="font-medium text-foreground">
            {perDay.toFixed(1)}h/day
          </span>
          <span>·</span>
          <span className="font-medium text-foreground">
            {perWeek.toFixed(1)}h/week
          </span>
          <span>
            ({remaining.toFixed(1)}h left over {daysLeft}{" "}
            {daysLeft === 1 ? "day" : "days"})
          </span>
        </p>
      )}

      {/* Add hours */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <input
          type="date"
          value={dayDraft}
          min={minDay}
          max={maxDay}
          onChange={(e) => setDayDraft(e.target.value)}
          aria-label="Day"
          className="h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
        />
        <input
          type="number"
          min={0}
          step={0.25}
          inputMode="decimal"
          value={hoursDraft}
          onChange={(e) => setHoursDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addHours();
          }}
          placeholder="0"
          className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">h</span>
        <input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addHours();
          }}
          placeholder="Note (optional)"
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          onClick={addHours}
          disabled={!hoursDraft.trim()}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* Hours logged directly this month — editable */}
      {directEntries.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {directEntries.map((e) => (
            <DirectEntryRow
              key={e.id}
              entry={e}
              minDay={minDay}
              maxDay={maxDay}
              onUpdate={(u) => onUpdateEntry(e.id, u)}
              onDelete={() => onDeleteEntry(e.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DirectEntryRow({
  entry,
  minDay,
  maxDay,
  onUpdate,
  onDelete,
}: {
  entry: TimeEntry;
  minDay: string;
  maxDay: string;
  onUpdate: (updates: {
    seconds?: number;
    label?: string;
    createdAt?: number;
  }) => void;
  onDelete: () => void;
}) {
  const [hoursDraft, setHoursDraft] = React.useState(
    secsToHoursStr(entry.seconds)
  );
  const [noteDraft, setNoteDraft] = React.useState(entry.label ?? "");

  React.useEffect(() => {
    setHoursDraft(secsToHoursStr(entry.seconds));
  }, [entry.seconds]);

  const commitHours = () => {
    const h = parseFloat(hoursDraft.replace(",", "."));
    if (!Number.isNaN(h) && h > 0) onUpdate({ seconds: Math.round(h * 3600) });
    else setHoursDraft(secsToHoursStr(entry.seconds));
  };

  return (
    <li className="group flex items-center gap-1.5">
      <input
        type="date"
        value={ymd(new Date(entry.createdAt))}
        min={minDay}
        max={maxDay}
        onChange={(ev) => {
          if (ev.target.value) onUpdate({ createdAt: dayToTs(ev.target.value) });
        }}
        aria-label="Day"
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
      />
      <input
        value={hoursDraft}
        inputMode="decimal"
        onChange={(ev) =>
          setHoursDraft(ev.target.value.replace(/[^0-9.,]/g, ""))
        }
        onBlur={commitHours}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
        }}
        className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-xs tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <span className="text-xs text-muted-foreground">h</span>
      <input
        value={noteDraft}
        onChange={(ev) => setNoteDraft(ev.target.value)}
        onBlur={() => onUpdate({ label: noteDraft.trim() || undefined })}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
        }}
        placeholder="Note (optional)"
        className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-2 text-xs outline-none focus-visible:bg-accent"
      />
      <button
        onClick={onDelete}
        aria-label="Delete hours"
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
