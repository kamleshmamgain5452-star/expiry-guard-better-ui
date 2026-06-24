// One-off: rasterize the ExpiryGuard icon to the PNG sizes the PWA needs.
// Run from the project root with: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");

const appIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#34d399"/>
      <stop offset="1" stop-color="#1f9b76"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <path d="M256 92 L394 150 V270 C394 358 332 416 256 438 C180 416 118 358 118 270 V150 Z"
        fill="rgba(255,255,255,0.16)"/>
  <path d="M206 266 l34 34 l70 -86" fill="none" stroke="#ffffff"
        stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Monochrome white silhouette for the Android status-bar badge.
const badgeIcon = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <path d="M48 12 L78 24 V50 C78 69 65 81 48 86 C31 81 18 69 18 50 V24 Z" fill="#ffffff"/>
</svg>`;

await mkdir(OUT, { recursive: true });

const tasks = [
  { name: "icon-192.png", size: 192, svg: appIcon },
  { name: "icon-512.png", size: 512, svg: appIcon },
  { name: "apple-touch-icon.png", size: 180, svg: appIcon },
  { name: "badge-72.png", size: 72, svg: badgeIcon }
];

for (const t of tasks) {
  await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(OUT, t.name));
  console.log("wrote", t.name);
}
