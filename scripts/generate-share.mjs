import { readFile } from 'node:fs/promises';
import { chromium } from './libraries.mjs';

const svg = await readFile('scripts/assets/share-card.svg', 'utf8');
const font = (await readFile('public/fonts/noto-sans-sc-subset.woff2')).toString('base64');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>@font-face{font-family:ShareChinese;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 600}body{margin:0}svg text{font-family:ShareChinese,sans-serif}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/share.png' });
  console.log('Generated public/share.png (1200 × 630) from local SVG and font.');
} finally {
  await browser.close();
}
