"use client";

import * as React from "react";
import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { isTauri } from "@/lib/storage";
import { useOffline } from "@/components/offline-provider";

export function AuthButton() {
  const { configured, user, loading, signInWithGoogle, signOut } = useAuth();
  const { setOffline } = useOffline();

  // Hidden until Supabase is configured, and on desktop (webview OAuth is
  // unreliable — desktop runs local-first).
  if (isTauri()) return null;
  if (!configured) return null;
  if (loading) return null;

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={signInWithGoogle}
      >
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>
    );
  }

  const email = user.email ?? "Account";
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Signed in as
          <div className="truncate font-medium text-foreground">{email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            setOffline(false);
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
