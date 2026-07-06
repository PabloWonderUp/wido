"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { LoginScreen } from "@/components/login-screen";

/**
 * Requires sign-in before the app is usable. When Supabase isn't configured
 * (no env vars) it falls through to local-only mode so dev never bricks.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { configured, user, loading } = useAuth();

  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <>{children}</>;
}
