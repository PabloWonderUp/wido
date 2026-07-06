import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/service-worker";
import { ClientManagerProvider } from "@/components/client-manager";
import { AuthSync } from "@/components/auth-sync";

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
          <ClientManagerProvider>{children}</ClientManagerProvider>
          <AuthSync />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
