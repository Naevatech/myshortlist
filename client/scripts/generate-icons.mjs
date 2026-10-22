// Generates the PWA icons in public/: a letter S on white with a thin accent border.
// Run with `npm run icons -w client`. The S is drawn as a path so no font is needed to render it.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const ACC = '#1F3A5F';
const INK = '#111111';

// An S built from two arcs, in a 100 x 100 box, stroked like Inter Medium.
const S_PATH = 'M63 34.5C60.6 29.4 55.8 26.5 50 26.5C42.6 26.5 37 30.6 37 36.8C37 50.5 64 44.6 64 60.9C64 67.8 57.9 73.5 50 73.5C43.3 73.5 37.9 70.2 35.5 64.8';

function svg({ padding, border, radius }) {
  const inner = 100 - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#FFFFFF"/>
  ${border ? `<rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${radius}" fill="none" stroke="${ACC}" stroke-width="2"/>` : ''}
  <g transform="translate(50 50) scale(${inner / 100}) translate(-50 -50)">
    <path d="${S_PATH}" fill="none" stroke="${INK}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const standard = svg({ padding: 6, border: true, radius: 14 });
// Maskable icons keep everything inside the central 80% safe zone.
const maskable = svg({ padding: 16, border: true, radius: 12 });

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'favicon.svg'), standard);
await sharp(Buffer.from(standard)).resize(192, 192).png().toFile(path.join(out, 'pwa-192.png'));
await sharp(Buffer.from(standard)).resize(512, 512).png().toFile(path.join(out, 'pwa-512.png'));
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(path.join(out, 'maskable-512.png'));
await sharp(Buffer.from(standard)).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
console.log('Icons written to', out);
