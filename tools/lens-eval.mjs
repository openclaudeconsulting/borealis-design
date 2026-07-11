/* ============================================================
   lens-eval — corpus harness for Roam's price scanner.

   Renders realistic price-tag / receipt / menu / signage scenarios
   to images, runs the SAME OCR configuration the Lens uses
   (Tesseract, PSM 6, the shared character set), parses each OCR
   line with parsePrice({ strict: true }) exactly like lens.js, and
   scores the results against ground truth.

   This is the regression suite for the "is this number a price?"
   decision. Any change to parsePrice.js or the Lens OCR settings
   should keep this at 100%.

   Usage:
     node tools/lens-eval.mjs

   Requires tesseract.js and playwright to be resolvable; override
   locations via env when they live elsewhere:
     TESSERACT_DIR=/path/to/node_modules/tesseract.js
     TESSERACT_CORE_DIR=/path/to/node_modules/tesseract.js-core
     PLAYWRIGHT_DIR=/path/to/node_modules/playwright
     CHROMIUM_PATH=/path/to/chromium
   Language data defaults to the app's vendored copy.
   ============================================================ */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { parsePrice } from '../converter/lib/parsePrice.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const req = (envDir, name) => require_(process.env[envDir] ? path.join(process.env[envDir], 'src/index.js').replace('src/index.js', '') : name);

const Tesseract = process.env.TESSERACT_DIR ? require_(process.env.TESSERACT_DIR) : req('', 'tesseract.js');
const playwright = process.env.PLAYWRIGHT_DIR ? require_(process.env.PLAYWRIGHT_DIR) : req('', 'playwright');

// ——— Keep these two in sync with converter/lens.js ———
// PSM 4 = single column, variable text sizes. Critical: price tags put a huge
// price under small description lines, and PSM 6 ("uniform block") silently
// DROPS the price line for violating its uniformity assumption.
const OCR_WHITELIST = '0123456789.,\'€£$¥₩₹฿%ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÉÈéè /()-';
const OCR_PSM = '4';

/* ============================================================
   Corpus. html is the visual scene; shop is the traveller's
   destination currency; expect lists the prices a correct scanner
   must extract (in top-to-bottom order). [] = must find NOTHING.
   ============================================================ */
const CORPUS = [
  {
    name: 'george-clothing-tag (the real-world failure)',
    shop: 'CAD', expect: [17],
    html: `<div style="text-align:center;padding:26px;font-family:Georgia,serif">
      <div style="font-size:46px;font-weight:600">George.</div>
      <div style="font-size:20px;margin-top:14px;font-family:Arial">40% RECYCLED POLYESTER</div>
      <div style="font-size:20px;font-family:Arial">POLYESTER RECYCLE</div>
      <div style="font-size:64px;font-weight:800;margin-top:18px;font-family:Arial">$17</div>
    </div>`,
  },
  {
    name: 'sale-sign percent only',
    shop: 'CAD', expect: [],
    html: `<div style="text-align:center;padding:30px;font-family:Arial">
      <div style="font-size:60px;font-weight:800">SAVE 20%</div>
      <div style="font-size:30px;margin-top:10px">TODAY ONLY</div>
    </div>`,
  },
  {
    name: 'shelf label with unit price',
    shop: 'USD', expect: [0.79],
    html: `<div style="padding:30px;font-family:Arial">
      <div style="font-size:34px;font-weight:700">BANANAS</div>
      <div style="font-size:56px;font-weight:800;margin-top:8px">$0.79 /lb</div>
    </div>`,
  },
  {
    name: 'net weight is not a price',
    shop: 'EUR', expect: [],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:44px;font-weight:700">NET WT 500g</div>
    </div>`,
  },
  {
    name: 'two-for deal: only the money counts',
    shop: 'USD', expect: [6],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:58px;font-weight:800">2 FOR $6</div>
    </div>`,
  },
  {
    name: 'EU tag comma decimal',
    shop: 'EUR', expect: [19.99],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:62px;font-weight:800">19,99 €</div>
    </div>`,
  },
  {
    name: 'JPY symbol tag',
    shop: 'JPY', expect: [1500],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:62px;font-weight:800">¥1500</div>
    </div>`,
  },
  {
    name: 'JPY bare integer (normal there)',
    shop: 'JPY', expect: [1500],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:62px;font-weight:800">1500</div>
    </div>`,
  },
  {
    name: 'bare integer rejected in decimal-currency land',
    shop: 'CAD', expect: [],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:62px;font-weight:800">40</div>
    </div>`,
  },
  {
    name: 'receipt block',
    shop: 'USD', expect: [45.67, 5.94, 51.61],
    html: `<div style="padding:26px;font-family:'Courier New',monospace;font-size:34px;font-weight:700">
      <div>SUBTOTAL&nbsp;&nbsp;&nbsp;45.67</div>
      <div>TAX&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;5.94</div>
      <div>TOTAL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;51.61</div>
    </div>`,
  },
  {
    name: 'menu with dish names',
    shop: 'EUR', expect: [14.5, 12, 9.5],
    html: `<div style="padding:26px;font-family:Georgia,serif;font-size:34px">
      <div>PASTA CARBONARA&nbsp;&nbsp;14.50</div>
      <div>MARGHERITA&nbsp;&nbsp;12.00</div>
      <div>HOUSE WINE&nbsp;&nbsp;9.50</div>
    </div>`,
  },
  {
    name: 'thousands separator price',
    shop: 'USD', expect: [1299.99],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:58px;font-weight:800">$1,299.99</div>
    </div>`,
  },
  {
    name: 'pack count is not a price',
    shop: 'USD', expect: [],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:58px;font-weight:800">6 pk</div>
    </div>`,
  },
  {
    name: 'CHF prefixed price',
    shop: 'CHF', expect: [24.9],
    html: `<div style="padding:30px;font-family:Arial;text-align:center">
      <div style="font-size:58px;font-weight:800">CHF 24.90</div>
    </div>`,
  },
  {
    name: 'discount sign with real price below',
    shop: 'USD', expect: [29.99],
    html: `<div style="padding:26px;font-family:Arial;text-align:center">
      <div style="font-size:44px;font-weight:800">30% OFF</div>
      <div style="font-size:58px;font-weight:800;margin-top:10px">NOW $29.99</div>
    </div>`,
  },
];

/* ============================================================ */
async function main() {
  const chromium = playwright.chromium;
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 760, height: 460 }, deviceScaleFactor: 2 });

  const coreDir = process.env.TESSERACT_CORE_DIR || path.join(path.dirname(require_.resolve('tesseract.js/package.json')), '..', 'tesseract.js-core');
  const langDir = process.env.TESSDATA_DIR || path.join(here, '..', 'converter', 'vendor', 'tesseract', 'lang');
  const worker = await Tesseract.createWorker('eng', 1, {
    corePath: coreDir, langPath: langDir, gzip: true, cacheMethod: 'none', logger: () => {},
  });
  await worker.setParameters({ tessedit_char_whitelist: OCR_WHITELIST, tessedit_pageseg_mode: OCR_PSM });

  let pass = 0, fail = 0;
  for (const c of CORPUS) {
    await page.setContent(`<body style="margin:0;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;min-height:460px">${c.html}</body>`);
    const png = await page.screenshot();
    const { data } = await worker.recognize(png);
    const lines = (data.lines && data.lines.length) ? data.lines
      : String(data.text || '').split('\n').map((t) => ({ text: t, confidence: data.confidence }));
    const got = [];
    for (const ln of lines) {
      if (!ln.text) continue;
      if (ln.confidence != null && ln.confidence < 30) continue;
      const p = parsePrice(ln.text, { shopCurrency: c.shop, strict: true });
      if (p && p.value > 0) got.push(p.value);
    }
    const ok = got.length === c.expect.length && got.every((v, i) => Math.abs(v - c.expect[i]) < 1e-9);
    if (ok) { pass++; console.log(`PASS  ${c.name}  →  [${got.join(', ')}]`); }
    else {
      fail++;
      console.log(`FAIL  ${c.name}`);
      console.log(`      expected [${c.expect.join(', ')}]  got [${got.join(', ')}]`);
      console.log(`      OCR text: ${JSON.stringify(data.text)}`);
    }
  }
  await worker.terminate();
  await browser.close();
  console.log(`\nlens-eval: ${pass}/${pass + fail} scenarios pass`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
