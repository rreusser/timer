/**
 * Capture the screenshots referenced by the web app manifest. Chrome uses
 * them for the richer install dialog on Android.
 *
 * Playwright is not a project dependency — this is an opt-in, dev-only step:
 *
 *   npm run build
 *   npx --yes playwright@latest install chromium
 *   node tools/generate-screenshots.mjs
 *   npm run build   # copy the new screenshots into dist/
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const outDir = join(here, '..', 'public', 'screenshots');
await mkdir(outDir, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURI((req.url ?? '/').split('?')[0]));
  const file = join(dist, path.endsWith('/') ? path + 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(4178, '127.0.0.1', resolve));

const browser = await chromium.launch();

async function open(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  // Skip the tour: the screenshots should show the app itself.
  await context.addInitScript(() => localStorage.setItem('reactionTrainer.tourDisabled', 'true'));
  await page.goto('http://127.0.0.1:4178/index.html', { waitUntil: 'load' });
  await page.waitForSelector('input[type=range]');
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function setSlider(page, name, value) {
  await page.getByRole('slider', { name, exact: true }).evaluate((node, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, String(v));
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// Menu, narrow and wide.
for (const [width, height, name] of [
  [390, 780, 'menu-narrow.png'],
  [1280, 800, 'menu-wide.png'],
]) {
  const { context, page } = await open(width, height);
  await page.screenshot({ path: join(outDir, name) });
  await context.close();
  console.log(`${name} ${width}x${height}`);
}

// The training screen, caught mid-"Go!".
{
  const { context, page } = await open(390, 780);
  await setSlider(page, 'Starting Delay', 1);
  await setSlider(page, 'Starting Delay Randomness', 0);
  await setSlider(page, 'Goal Time', 10);
  await setSlider(page, 'Time Between Rounds', 1);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent === 'Go!', {
    timeout: 15000,
  });
  await page.screenshot({ path: join(outDir, 'train-narrow.png') });
  await context.close();
  console.log('train-narrow.png 390x780');
}

await browser.close();
server.close();
