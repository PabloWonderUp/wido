"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { cn, clientMonthSeconds, formatHours, formatMoney } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import { useTasks } from "@/hooks/use-tasks";
import { useClients } from "@/hooks/use-clients";

export default function HoursPage() {
  const { tasks, hydrated } = useTasks();
  const { clients } = useClients();

  // Current month offset: 0 = this month, -1 = last month, …
  const [offset, setOffset] = React.useState(0);

  const base = new Date();
  const viewed = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = viewed.getFullYear();
  const monthIndex = viewed.getMonth();
  const monthLabel = viewed.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const freelanceClients = clients.filter((c) => c.hourTracking);

  const rows = freelanceClients.map((c) => {
    const seconds = clientMonthSeconds(tasks, c.id, year, monthIndex);
    const hours = seconds / 3600;
    const target = c.monthlyHoursTarget ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((hours / target) * 100)) : 0;
    const rate = c.hourlyRate ?? 0;
    const amount = hours * rate;
    return { client: c, seconds, hours, target, pct, rate, amount };
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
                  {formatMoney(totalMoney)}
                </span>
              </>
            )}
          </p>
        </div>
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
          rows.map(({ client, seconds, hours, target, pct, rate, amount }) => (
            <div
              key={client.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
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
                      {formatMoney(amount)} @ ${rate}/h
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
                        backgroundColor:
                          hours >= target ? undefined : client.color,
                      }}
                    />
                  </div>
                </div>
              )}

              {target === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  No monthly goal set — add one in Clients.
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
