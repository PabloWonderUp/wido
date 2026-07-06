// Generates PWA + Tauri source icons from an inline SVG.
// Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// A rounded-square "check" mark — matches the app's dark, minimal look.
function svg({ size, padding }) {
  const s = size;
  const r = Math.round(s * 0.22);
  // Checkmark path scaled to the inner (padded) area.
  const inset = Math.round(s * padding);
  const w = s - inset * 2;
  const p = (x, y) => `${inset + x * w},${inset + y * w}`;
  const stroke = Math.max(2, Math.round(w * 0.11));
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="#111111"/>
  <polyline points="${p(0.16, 0.54)} ${p(0.42, 0.78)} ${p(0.84, 0.24)}"
    fill="none" stroke="#ffffff" stroke-width="${stroke}"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);
}

const targets = [
  { file: "public/icons/icon-192.png", size: 192, padding: 0.28 },
  { file: "public/icons/icon-512.png", size: 512, padding: 0.28 },
  // Maskable needs extra safe-zone padding so nothing gets clipped.
  { file: "public/icons/maskable-512.png", size: 512, padding: 0.34 },
  { file: "public/icons/apple-touch-icon.png", size: 180, padding: 0.26 },
  { file: "public/favicon.png", size: 64, padding: 0.24 },
  // 1024 source for `tauri icon` to derive all platform icons.
  { file: "src-tauri/icons/icon-source.png", size: 1024, padding: 0.28 },
];

await mkdir("public/icons", { recursive: true });
await mkdir("src-tauri/icons", { recursive: true });

for (const t of targets) {
  const png = await sharp(svg(t)).png().toBuffer();
  await writeFile(t.file, png);
  console.log("wrote", t.file);
}
