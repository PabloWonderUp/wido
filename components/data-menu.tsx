"use client";

import * as React from "react";
import { Database, Download, History, RefreshCw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getState, replaceState } from "@/hooks/store";
import { exportToJson, importFromJson } from "@/lib/storage";
import { historyAvailable } from "@/lib/storage/history";
import { hardResetDevice } from "@/lib/hard-reset";
import { HistoryDialog } from "@/components/history-dialog";

export function DataMenu() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  // History is cloud-only and the active user is set asynchronously after
  // login, so evaluate it each time the menu opens rather than on mount.
  const [canRecover, setCanRecover] = React.useState(false);

  const handleExport = () => {
    const json = exportToJson(getState());
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `tasks-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const next = importFromJson(text);
      const current = getState();
      const hasData = current.tasks.length > 0 || current.clients.length > 0;
      if (
        hasData &&
        !window.confirm(
          "Import will replace your current tasks and clients. Continue?"
        )
      ) {
        return;
      }
      replaceState(next);
    } catch {
      window.alert("Couldn't read that file — is it a valid backup?");
    }
  };

  return (
    <>
      <DropdownMenu
        onOpenChange={(o) => {
          if (o) setCanRecover(historyAvailable());
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Backup & restore">
            <Database className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={handleExport}>
            <Download className="h-4 w-4" /> Export backup
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import backup
          </DropdownMenuItem>
          {canRecover && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <History className="h-4 w-4" /> Version history
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <RefreshCw className="h-4 w-4" /> Reset this device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />

      <Dialog open={resetOpen} onOpenChange={(o) => !resetting && setResetOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset this device</DialogTitle>
            <DialogDescription>
              Clears this device&apos;s cache and local copy, then reloads a
              fresh copy from the cloud. Use this if you see old or deleted tasks
              coming back. Your account and data stay safe in the cloud, and you
              stay signed in.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setResetting(true);
                void hardResetDevice();
              }}
              disabled={resetting}
            >
              {resetting ? "Resetting…" : "Reset & reload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
