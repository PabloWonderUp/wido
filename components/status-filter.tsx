"use client";

import { cn } from "@/lib/utils";
import { STATUSES, STATUS_META } from "@/lib/status";
import type { StatusFilter as StatusFilterValue } from "@/lib/types";

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const options: { value: StatusFilterValue; label: string }[] = [
    { value: "all", label: "All" },
    ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
