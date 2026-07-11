"use client";

import * as React from "react";
import { Check, Settings2, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/use-clients";
import { useClientManager } from "@/components/client-manager";

/**
 * Client assignment dropdown, shared by the task row and the expanded panel.
 * `children` is the trigger (must be a single focusable element). Clicks are
 * kept from bubbling so it works inside a row that expands on click.
 */
export function ClientPicker({
  value,
  onChange,
  children,
}: {
  value: string | undefined;
  onChange: (clientId: string | undefined) => void;
  children: React.ReactNode;
}) {
  const { clients, addClient } = useClients();
  const { open: openClientManager } = useClientManager();
  const [newClient, setNewClient] = React.useState("");

  const createAndAssign = () => {
    const trimmed = newClient.trim();
    if (!trimmed) return;
    const client = addClient(trimmed);
    if (client) {
      onChange(client.id);
      setNewClient("");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onClick={(e) => e.stopPropagation()}
      >
        {clients.map((client) => (
          <DropdownMenuItem
            key={client.id}
            onSelect={() => onChange(client.id)}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: client.color }}
              />
              {client.name}
            </span>
            {value === client.id && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
        {value && (
          <DropdownMenuItem
            onSelect={() => onChange(undefined)}
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => openClientManager()}
          className="text-muted-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" /> Manage clients & colors…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
