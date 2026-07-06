"use client";

import * as React from "react";
import { ImagePlus, Plus, Trash2, Users, X } from "lucide-react";

import { cn, fileToLogoDataUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClients } from "@/hooks/use-clients";
import type { Client } from "@/lib/types";

// --- Context: lets any component open the client manager dialog ---

const ClientManagerContext = React.createContext<{ open: () => void } | null>(
  null
);

export function useClientManager() {
  const ctx = React.useContext(ClientManagerContext);
  if (!ctx) throw new Error("useClientManager must be used within provider");
  return ctx;
}

export function ClientManagerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <ClientManagerContext.Provider value={value}>
      {children}
      <ClientManagerDialog open={open} onOpenChange={setOpen} />
    </ClientManagerContext.Provider>
  );
}

/** Header button that opens the manager. */
export function ClientManagerButton() {
  const { open } = useClientManager();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Manage clients"
      onClick={open}
    >
      <Users className="h-4 w-4" />
    </Button>
  );
}

function ClientManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const [newName, setNewName] = React.useState("");

  const add = () => {
    if (addClient(newName)) setNewName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clients</DialogTitle>
          <DialogDescription>
            Add, rename, recolor or delete. Click the circle to set a logo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {clients.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No clients yet.
            </p>
          )}
          {clients.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              onUpdate={(u) => updateClient(client.id, u)}
              onDelete={() => deleteClient(client.id)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <div className="flex h-9 w-9 items-center justify-center">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="New client name…"
            className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button size="sm" onClick={add} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClientRow({
  client,
  onUpdate,
  onDelete,
}: {
  client: Client;
  onUpdate: (updates: Partial<Client>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = React.useState(client.name);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== client.name) onUpdate({ name: trimmed });
    else setName(client.name);
  };

  const handleLogo = async (file: File) => {
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      onUpdate({ logo: dataUrl });
    } catch {
      window.alert("Couldn't read that image.");
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
      {/* Logo / avatar */}
      <div className="relative">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Set logo"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white shadow-sm"
          style={client.logo ? undefined : { backgroundColor: client.color }}
        >
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo}
              alt={client.name}
              className="h-full w-full object-cover"
            />
          ) : (
            client.name.charAt(0).toUpperCase() || (
              <ImagePlus className="h-4 w-4" />
            )
          )}
        </button>
        {client.logo && (
          <button
            onClick={() => onUpdate({ logo: undefined })}
            aria-label="Remove logo"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleLogo(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Name */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-8 flex-1 rounded-md bg-transparent px-2 text-sm font-medium outline-none focus-visible:bg-accent"
      />

      {/* Color */}
      <label
        className="relative h-7 w-7 shrink-0 cursor-pointer rounded-full ring-1 ring-border"
        style={{ backgroundColor: client.color }}
        title="Pick color"
      >
        <input
          type="color"
          value={client.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      {/* Delete */}
      <button
        onClick={() => {
          if (window.confirm(`Delete client "${client.name}"?`)) onDelete();
        }}
        aria-label="Delete client"
        className={cn(
          "rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
