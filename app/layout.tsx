import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/service-worker";
import { ClientManagerProvider } from "@/components/client-manager";
import { NoteDialogProvider } from "@/components/note-dialog";
import { AuthSync } from "@/components/auth-sync";
import { AuthGate } from "@/components/auth-gate";
import { OfflineProvider } from "@/components/offline-provider";
import { FloatingStopwatch } from "@/components/floating-stopwatch";
import { StopwatchTitle } from "@/components/stopwatch-title";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Wido",
  description: "Wido — what you're working on.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Wido",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <OfflineProvider>
            <ClientManagerProvider>
              <NoteDialogProvider>
                <AuthGate>{children}</AuthGate>
              </NoteDialogProvider>
            </ClientManagerProvider>
          </OfflineProvider>
          <AuthSync />
          <FloatingStopwatch />
          <StopwatchTitle />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
