import { APP_VERSION } from "@/lib/version";

/** Small pill in the header showing the app logo + which version is live. */
export function VersionBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm"
      title={`Wido v${APP_VERSION}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon.png" alt="Wido" className="h-4 w-4 rounded-sm" />
      v{APP_VERSION}
    </span>
  );
}
