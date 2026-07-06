import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface ClientBadgeProps {
  client: Client;
  className?: string;
}

/**
 * Colored pill for a client: a translucent tint of the client's color with
 * text in the same color — matching the reference design.
 */
export function ClientBadge({ client, className }: ClientBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: `${client.color}22`,
        color: client.color,
      }}
    >
      {client.name}
    </span>
  );
}
