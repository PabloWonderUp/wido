"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface TaskInputProps {
  onAdd: (title: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function TaskInput({ onAdd, inputRef }: TaskInputProps) {
  const [value, setValue] = React.useState("");

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition-colors focus-within:border-muted-foreground/40"
      )}
    >
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
        placeholder="Add a task and press enter…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
