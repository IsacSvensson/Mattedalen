// Renders public/icons/icon.svg to the PNG sizes a PWA needs.
// Run with: node scripts/make-icons.mjs   (uses Playwright's Chromium)
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(size, file, { padding = 0, background = 'transparent' } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - 2 * padding;
  await page.setContent(
    `<body style="margin:0;background:${background}"><div style="padding:${padding}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: background === 'transparent' });
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
// Maskable: launchers crop to a circle/squircle, keep the art inside the safe zone.
await render(512, 'icon-maskable-512.png', { padding: 56, background: '#fbf6ea' });
// iOS adds its own rounded corners and does not support transparency.
await render(180, 'apple-touch-icon.png', { background: '#fbf6ea' });
await browser.close();
