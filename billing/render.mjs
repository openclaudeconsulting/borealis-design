// Render the Borealis Design billing documents (HTML -> PDF) with Playwright/Chromium.
//
//   npm i -D playwright && npx playwright install chromium
//   node render.mjs
//
// Fonts (Inter + Instrument Serif) are embedded as base64 in fonts/embedded.css,
// so rendering is fully offline and deterministic.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const jobs = [
  { html: 'invoice.html',    pdf: 'Borealis-Design-Invoice-BD-2026-001.pdf' },
  { html: 'rate-scope.html', pdf: 'Borealis-Design-Rate-and-Scope-Sheet.pdf' },
];

// Honor a pre-installed Chromium via CHROMIUM_PATH, otherwise let Playwright find its own.
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
for (const j of jobs) {
  await page.goto(pathToFileURL(path.join(dir, j.html)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(dir, j.pdf),
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log('wrote', j.pdf);
}
await browser.close();
