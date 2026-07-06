import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/service-worker";
import { ClientManagerProvider } from "@/components/client-manager";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Tasks",
  description: "A minimal personal task tracker.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Tasks",
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
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
