"use client";

import * as React from "react";
import { Database, Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getState, replaceState } from "@/hooks/store";
import { exportToJson, importFromJson } from "@/lib/storage";

export function DataMenu() {
  const fileRef = React.useRef<HTMLInputElement>(null);

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
      <DropdownMenu>
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
        </DropdownMenuContent>
      </DropdownMenu>

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
