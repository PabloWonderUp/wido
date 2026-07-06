"use client";

import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface ClientFilterProps {
  clients: Client[];
  /** Selected client id, or null for "no client filter". */
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ClientFilter({ clients, value, onChange }: ClientFilterProps) {
  if (clients.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {clients.map((client) => {
        const active = client.id === value;
        return (
          <button
            key={client.id}
            onClick={() => onChange(active ? null : client.id)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
              active && "ring-1"
            )}
            style={{
              backgroundColor: active ? client.color : `${client.color}22`,
              color: active ? "#fff" : client.color,
              // @ts-expect-error CSS custom prop for the ring color
              "--tw-ring-color": client.color,
            }}
          >
            {client.name}
          </button>
        );
      })}
    </div>
  );
}
