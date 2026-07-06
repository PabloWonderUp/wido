"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, ListTodo, Timer } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Tasks", icon: ListTodo },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/hours", label: "Hours", icon: Clock },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
