/**
 * "Reset this device": wipe every local trace of the app on this device — the
 * service worker, Cache Storage, and localStorage — then hard-reload.
 *
 * The Supabase auth session is preserved so the user stays signed in. When
 * signed in the cloud is the source of truth, so the app re-pulls a clean copy
 * on reload; this clears any stale local cache that was resurrecting deleted
 * tasks. Each step is isolated so one failure never blocks the rest.
 */
export async function hardResetDevice(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (err) {
    console.error("[wido] service worker unregister failed", err);
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.error("[wido] cache clear failed", err);
  }

  try {
    // Drop the local data cache + view/timer prefs + offline flag, but KEEP the
    // Supabase auth session so the user isn't logged out.
    const keep = (k: string) => k.startsWith("sb-") || k.includes("supabase");
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !keep(k)) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.error("[wido] localStorage clear failed", err);
  }

  window.location.reload();
}
