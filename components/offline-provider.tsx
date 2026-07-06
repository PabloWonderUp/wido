"use client";

import * as React from "react";

const KEY = "wido-offline";

type OfflineContext = {
  offline: boolean;
  setOffline: (v: boolean) => void;
};

const Ctx = React.createContext<OfflineContext | null>(null);

/** Tracks whether the user chose to use the app without an account. */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOfflineState] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  const setOffline = React.useCallback((v: boolean) => {
    setOfflineState(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(() => ({ offline, setOffline }), [offline, setOffline]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOffline(): OfflineContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) return { offline: false, setOffline: () => {} };
  return ctx;
}
