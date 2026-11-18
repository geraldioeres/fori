// Render public/favicon.svg into the PNG app icons. Run: npm run icons
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'public/favicon.svg'), 'utf8');
const outDir = process.argv[2] ?? join(root, 'public/icons');

/** name → [size, background, padding fraction]. Maskable/Apple icons get a solid background and safe-zone padding. */
const ICONS = {
  'favicon-32.png': [32, null, 0.02],
  'icon-192.png': [192, null, 0.04],
  'icon-512.png': [512, null, 0.04],
  'maskable-512.png': [512, '#ffffff', 0.2],
  'apple-touch-icon.png': [180, '#ffffff', 0.12],
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, [size, bg, pad]] of Object.entries(ICONS)) {
  const inner = Math.round(size * (1 - pad * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg ?? 'transparent'}">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
    </body></html>`,
  );
  await writeFile(join(outDir, name), await page.screenshot({ omitBackground: !bg }));
  console.log(`${name} ${size}x${size}`);
}
await browser.close();
