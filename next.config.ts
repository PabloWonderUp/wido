import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static, client-only app. Works for Vercel, PWA install, and Tauri
  // (which serves the exported `out/` directory).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
