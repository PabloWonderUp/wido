"use client";

import * as React from "react";

/** Registers the PWA service worker (skips inside the Tauri desktop app). */
export function ServiceWorker() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if ("__TAURI_INTERNALS__" in window) return; // native app doesn't need it
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal.
    });
  }, []);

  return null;
}
