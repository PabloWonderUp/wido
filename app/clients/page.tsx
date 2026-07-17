"use client";

import { AppNav } from "@/components/app-nav";
import { ClientsEditor } from "@/components/client-manager";

export default function ClientsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <AppNav />
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, rename, recolor, set a logo, and configure freelance hour
          tracking. Click a circle to upload a logo.
        </p>
      </header>

      <ClientsEditor />
    </main>
  );
}
