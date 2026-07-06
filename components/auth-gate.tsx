"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { isTauri } from "@/lib/storage";
import { useOffline } from "@/components/offline-provider";
import { LoginScreen } from "@/components/login-screen";

/**
 * Requires sign-in before the app is usable (web). Two exceptions fall through
 * to local mode: Supabase not configured (dev never bricks), and the desktop
 * app — Google OAuth is unreliable inside the Tauri webview, so desktop is
 * local-first (SQLite). Real desktop login needs a system-browser OAuth flow.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { configured, user, loading } = useAuth();
  const { offline } = useOffline();

  if (isTauri()) return <>{children}</>; // desktop is local-first (offline)
  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed in OR chose to work offline.
  if (user || offline) return <>{children}</>;

  return <LoginScreen />;
}
