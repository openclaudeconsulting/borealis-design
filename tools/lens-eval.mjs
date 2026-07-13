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
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { selectPrices } from '../converter/lib/parsePrice.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const req = (envDir, name) => require_(process.env[envDir] ? path.join(process.env[envDir], 'src/index.js').replace('src/index.js', '') : name);

const Tesseract = process.env.TESSERACT_DIR ? require_(process.env.TESSERACT_DIR) : req('', 'tesseract.js');
const playwright = process.env.PLAYWRIGHT_DIR ? require_(process.env.PLAYWRIGHT_DIR) : req('', 'playwright');

// ——— Keep these two in sync with converter/lens.js ———
// PSM 11 = sparse text. Critical: block/column modes (6 and even 4) silently
// DROP a huge price line when it doesn't fit the layout they assume; sparse
// finds every chunk with its bbox and we restore reading order ourselves.
const OCR_WHITELIST = '0123456789.,\'€£$¥₩₹฿%ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÉÈéè /()-';
const OCR_PSM = '11';

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
  {
    name: 'quebec shelf label (the real-world failure: codes, dates, unit price)',
    shop: 'CAD', expect: [8.49],
    html: `<div style="padding:18px;font-family:Arial;text-align:left;width:640px">
      <div style="font-size:19px">2026/03/11 &nbsp;&nbsp; 3 C20470 &nbsp; E</div>
      <div style="font-size:19px">006-28110-14602</div>
      <div style="font-size:19px">34818103</div>
      <div style="font-size:72px;font-weight:800;text-align:center;margin:6px 0">8,49</div>
      <div style="font-size:24px;text-align:center">1,31 $ / 100 ml</div>
      <div style="font-size:20px">SteFa pate rosee 648ml</div>
    </div>`,
  },
  {
    name: 'barcode digits only — nothing to convert',
    shop: 'CAD', expect: [],
    html: `<div style="padding:26px;font-family:Arial;text-align:center">
      <div style="font-size:30px;font-weight:600">006-28110-14602</div>
      <div style="font-size:30px;font-weight:600;margin-top:8px">34818103</div>
    </div>`,
  },
  {
    name: 'dot-matrix boutique tag (Tremblant-style, the real-world failure)',
    shop: 'CAD', expect: [65],
    html: `<div style="padding:20px;font-family:'Courier New',monospace;text-align:left">
      <div style="font-size:26px;font-weight:700">Boutiques Tremblant</div>
      <div style="position:relative;display:inline-block;font-size:82px;font-weight:700;margin:4px 0">$65.00
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,0) 0 3px,#fff 3px 6px),repeating-linear-gradient(90deg,rgba(255,255,255,0) 0 3px,#fff 3px 6px)"></div>
      </div>
      <div style="font-size:26px;font-weight:700">NOIR</div>
      <div style="font-size:26px;font-weight:700">10</div>
      <div style="font-size:34px;font-weight:800;margin-top:6px">SPECIAL 20% OFF</div>
    </div>`,
  },
  {
    name: 'vertical tag (rotated 90°, solid print)',
    shop: 'CAD', expect: [34.99],
    html: `<div style="transform:rotate(90deg);font-family:Arial;text-align:center">
      <div style="font-size:22px;font-weight:600">OUTDOOR GEAR</div>
      <div style="font-size:58px;font-weight:800">$34.99</div>
    </div>`,
  },
  {
    name: 'vertical dot-matrix tag (the Tremblant photo: rotated AND dotted)',
    shop: 'CAD', expect: [70],
    html: `<div style="transform:rotate(-90deg);font-family:'Courier New',monospace;text-align:center">
      <div style="font-size:20px;font-weight:700">Boutiques Tremblant</div>
      <div style="position:relative;display:inline-block;font-size:64px;font-weight:700;margin:4px 0">$70.00
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,0) 0 3px,#fff 3px 6px),repeating-linear-gradient(90deg,rgba(255,255,255,0) 0 3px,#fff 3px 6px)"></div>
      </div>
      <div style="font-size:20px;font-weight:700">NOIR &nbsp; 6</div>
    </div>`,
  },
  {
    name: 'electronics tag: big price beats small SKU line',
    shop: 'USD', expect: [499.99],
    html: `<div style="padding:22px;font-family:Arial;text-align:center">
      <div style="font-size:26px;font-weight:600">WIRELESS HEADPHONES</div>
      <div style="font-size:64px;font-weight:800;margin:8px 0">$499.99</div>
      <div style="font-size:18px">SKU 04581230 REG 549.99</div>
    </div>`,
  },
  // ——— Electronic shelf labels (ESL): superscript cents, no separator.
  // The real-world failures of IMG_2031/2033/2034: the huge price reads as
  // bare "699" + "99" (both rejected as prices) and a smaller decimal-
  // bearing line — the DISCOUNT or a FEE — used to win.
  {
    name: 'ESL: superscript cents vs RABAIS banner (DeWalt planer tag)',
    shop: 'CAD', expect: [699.99],
    html: `<div style="width:520px;padding:14px;font-family:Arial;background:#fff">
      <div style="background:#c8102e;color:#fff;font-weight:800;font-size:36px;padding:4px 10px">RABAIS 270,00</div>
      <div style="font-weight:800;font-size:26px;margin-top:8px">RABOT DEWALT 13 PO</div>
      <div style="display:flex;gap:18px;align-items:flex-start;margin-top:4px">
        <div style="font-size:17px;color:#444">prix courant<br>969,99</div>
        <div style="font-weight:800;font-size:100px;line-height:0.9">699<span style="font-size:44px;vertical-align:60px">99</span></div>
      </div>
      <div style="font-size:16px;margin-top:8px">Fin juil 16/26 &nbsp;&nbsp; Stk 4 &nbsp;&nbsp; 028G01</div>
      <div style="font-size:16px">055-9009-8</div>
    </div>`,
  },
  {
    // At this render Tesseract never sees the tiny "29" at all (discarded
    // as noise beside the 100px digits), so exact cents are unrecoverable —
    // the DOMINANT-INTEGER rescue must still surface the 601 dollars
    // instead of letting the "inclus ENV 1,30" fee line win.
    name: 'ESL: superscript cents invisible → dominant-integer rescue (drill tag)',
    shop: 'CAD', expect: [601],
    html: `<div style="width:520px;padding:14px;font-family:Arial;background:#fff">
      <div style="color:#c8102e;font-weight:800;font-size:30px">SUPER ACHAT</div>
      <div style="font-weight:700;font-size:24px">PERC&amp;VIS PERC DW 20V</div>
      <div style="font-weight:800;font-size:100px;line-height:0.9;margin-top:4px">601<span style="font-size:44px;vertical-align:60px">29</span></div>
      <div style="font-size:17px;color:#444">inclus ENV 1,30</div>
      <div style="font-size:16px;margin-top:8px">025G10 &nbsp; EH305D &nbsp; 054-8787-8</div>
    </div>`,
  },
  {
    // (The real tag read 584⁹³; headless Chromium's Arial substitute makes
    // Tesseract misread a giant '5', so the scenario uses 684⁹³ — the logic
    // under test, stitch + était-column demotion, is digit-agnostic.)
    name: 'ESL: superscript cents vs était was-price column (liquidation tag)',
    shop: 'CAD', expect: [684.93],
    html: `<div style="width:520px;padding:14px;font-family:Arial;background:#fff">
      <div style="color:#c8102e;font-weight:800;font-size:30px">LIQUIDATION</div>
      <div style="font-weight:700;font-size:22px">MAIS JEU 2EN1 BANZAI</div>
      <div style="display:flex;gap:18px;align-items:flex-start;margin-top:4px">
        <div style="font-size:19px;color:#444">était<br>949,99<br>649,93<br>636,49</div>
        <div style="font-weight:800;font-size:100px;line-height:0.9">684<span style="font-size:44px;vertical-align:60px">93</span></div>
      </div>
      <div style="font-size:16px;margin-top:8px">Stk 5 &nbsp;&nbsp; OBD018 &nbsp;&nbsp; 084-7236-8</div>
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

  // Preprocessing page: runs the app's ocrPrep passes (identical code) on the
  // rendered screenshot before OCR — pass A (greyContrast) always, pass B
  // (dotMatrixFuse) when pass A finds no prices, mirroring converter/lens.js.
  const prepSrc = fs.readFileSync(path.join(here, '..', 'converter', 'lib', 'ocrPrep.js'), 'utf8').replace(/export /g, '');
  const prep = await browser.newPage({ viewport: { width: 760, height: 460 } });
  await prep.addScriptTag({ content: prepSrc });
  const preprocess = async (pngBuf, mode, rot = 0) => {
    const dataUrl = 'data:image/png;base64,' + pngBuf.toString('base64');
    const out = await prep.evaluate(async ({ dataUrl, mode, rot }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height);
      if (mode === 'fuse') dotMatrixFuse(d.data, c.width, c.height); else greyContrast(d.data, c.width, c.height);
      x.putImageData(d, 0, 0);
      if (rot !== 90 && rot !== 270) return c.toDataURL('image/png');
      // Same rotation ops as converter/lens.js buildPassCanvas.
      const r = document.createElement('canvas'); r.width = c.height; r.height = c.width;
      const rx = r.getContext('2d');
      if (rot === 90) { rx.translate(c.height, 0); rx.rotate(Math.PI / 2); }
      else { rx.translate(0, c.width); rx.rotate(-Math.PI / 2); }
      rx.drawImage(c, 0, 0);
      return r.toDataURL('image/png');
    }, { dataUrl, mode, rot });
    return Buffer.from(out.split(',')[1], 'base64');
  };
  const ocrSelect = async (buf, shop) => {
    const { data } = await worker.recognize(buf);
    const lines = (data.lines && data.lines.length)
      ? data.lines
          .map((l) => ({ text: l.text, confidence: l.confidence, height: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0, top: l.bbox ? l.bbox.y0 : 0, bbox: l.bbox || null }))
          .sort((a, b) => a.top - b.top)
      : String(data.text || '').split('\n').map((t) => ({ text: t, confidence: data.confidence, height: 0 }));
    // Word detail for superscript-cents stitching — keep in sync with lens.js.
    const words = (data.words || [])
      .filter((w) => w && w.text && /\d/.test(w.text))
      .map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox || null }));
    return { got: selectPrices(lines, { shopCurrency: shop, words }).map((i) => i.value), text: data.text };
  };

  let pass = 0, fail = 0;
  for (const c of CORPUS) {
    await page.setContent(`<body style="margin:0;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;min-height:460px">${c.html}</body>`);
    const png = await page.screenshot();
    // Same fallback ladder as the live Lens: upright contrast first, then
    // dot-fuse, then rotations (solid + fused) until something reads.
    const LADDER = [['grey',0],['fuse',0],['grey',90],['fuse',90],['grey',270],['fuse',270]];
    let got = [], text = '';
    for (const [mode, rot] of LADDER) {
      ({ got, text } = await ocrSelect(await preprocess(png, mode, rot), c.shop));
      if (got.length) break;
    }
    const data = { text };
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
