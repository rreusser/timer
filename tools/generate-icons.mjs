/**
 * Rasterise the PWA icon set from the SVG sources in tools/icons/.
 *
 * Run with `npm run icons` after changing the artwork. Checked-in PNGs stay
 * reproducible instead of being mystery binaries.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

const TARGETS = [
  { source: 'icon.svg', out: 'icon-192.png', size: 192 },
  { source: 'icon.svg', out: 'icon-512.png', size: 512 },
  { source: 'icon.svg', out: 'apple-touch-icon.png', size: 180 },
  { source: 'maskable.svg', out: 'maskable-512.png', size: 512 },
];

await mkdir(publicDir, { recursive: true });

// The favicon ships as SVG; everything else is rasterised for platforms that
// still refuse SVG app icons.
await writeFile(join(publicDir, 'favicon.svg'), await readFile(join(here, 'icons', 'icon.svg')));

for (const { source, out, size } of TARGETS) {
  const svg = await readFile(join(here, 'icons', source));
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: '#353237' })
    .flatten({ background: '#353237' })
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, out));
  console.log(`${out.padEnd(22)} ${size}x${size}`);
}
