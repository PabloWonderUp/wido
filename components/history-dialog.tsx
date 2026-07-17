"use client";

import * as React from "react";
import { History, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { replaceState } from "@/hooks/store";
import {
  fetchHistoryState,
  listHistory,
  type HistoryVersion,
} from "@/lib/storage/history";

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Cloud version-history browser. Lists the previous states archived on every
 * save and lets the user restore one — the recovery net for accidental wipes.
 * Restoring is itself undoable: it writes through the normal save path, which
 * archives the current state first.
 */
export function HistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [versions, setVersions] = React.useState<HistoryVersion[]>([]);
  const [restoringId, setRestoringId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listHistory()
      .then((v) => {
        if (!cancelled) setVersions(v);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleRestore = async (v: HistoryVersion) => {
    if (
      !window.confirm(
        `Restore the version from ${formatWhen(v.replacedAt)}? ` +
          `Your current data is saved to history first, so you can undo this.`
      )
    ) {
      return;
    }
    setRestoringId(v.id);
    try {
      const state = await fetchHistoryState(v.id);
      if (!state) {
        window.alert("Couldn't load that version. Try again.");
        return;
      }
      replaceState(state);
      onOpenChange(false);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Version history
          </DialogTitle>
          <DialogDescription>
            Automatic snapshots taken before each save. Restore one to recover
            data that was changed or lost.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No previous versions yet. Snapshots appear here after your data
            changes while signed in.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {formatWhen(v.replacedAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.taskCount} tasks · {v.clientCount} clients ·{" "}
                    {v.noteCount} notes
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoringId !== null}
                  onClick={() => void handleRestore(v)}
                >
                  {restoringId === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
