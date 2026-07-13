/* ============================================================
   parsePrice — turn messy OCR text into { value, currency }.

   Handles international number formats:
     1,234.56  (US/UK)      -> 1234.56
     1.234,56  (EU)         -> 1234.56
     1 234,56  (FR)         -> 1234.56
     1'234.56  (CH)         -> 1234.56
     12,50     (EU decimal) -> 12.5
     1,500     (thousands)  -> 1500
     ¥1500 / €4,99 / $12.99 / £3.49 / 19.95 CHF

   Pure + dependency-free so it can be unit-tested in Node and reused
   in the browser (Lens) unchanged.
   ============================================================ */

// Symbol -> the currencies it can mean. First entry is the default.
export const SYMBOL_FAMILIES = {
  '€': ['EUR'],
  '£': ['GBP'],
  '$': ['USD', 'CAD', 'AUD', 'NZD', 'MXN', 'SGD', 'HKD', 'BRL', 'ARS', 'CLP', 'COP'],
  '¥': ['JPY', 'CNY'],
  '₩': ['KRW'],
  '₹': ['INR'],
  '฿': ['THB'],
  '₺': ['TRY'],
  '₫': ['VND'],
  '₴': ['UAH'],
  '₪': ['ILS'],
  '₱': ['PHP'],
  '﷼': ['SAR'],
  'zł': ['PLN'],
  'Kč': ['CZK'],
  'Ft': ['HUF'],
  'kr': ['SEK', 'NOK', 'DKK', 'ISK'],
  'CHF': ['CHF'],
  'Fr': ['CHF'],
  'R$': ['BRL'],
  'RM': ['MYR'],
  'Rp': ['IDR'],
};

// Multi-char tokens are matched before single-char symbols.
const SYMBOL_TOKENS = ['CHF', 'R$', 'Rp', 'RM', 'zł', 'Kč', 'Ft', 'Fr', 'kr',
  '€', '£', '$', '¥', '₩', '₹', '฿', '₺', '₫', '₴', '₪', '₱', '﷼'];

// Any 3-letter ISO code we recognise as a currency in free text. Keep this
// to currencies the app actually converts: every extra code is a false-
// positive surface (rotated-glyph garbage once OCR'd as "66 VES" and the
// unwanted VES entry blessed it as a price).
const ISO_CODES = new Set([
  'USD','EUR','GBP','JPY','CNY','AUD','CAD','CHF','INR','MXN','BRL','KRW','SGD',
  'HKD','NZD','SEK','NOK','DKK','PLN','THB','ZAR','TRY','AED','PHP','CZK','HUF',
  'ILS','MYR','IDR','VND','ISK','SAR','RON','CLP','COP','ARS','UAH','TWD','EGP',
  'MAD','PEN',
]);

// Currencies whose everyday prices are whole numbers — a bare integer there
// is normal ("¥1500"), whereas in decimal-currency lands a bare "40" is far
// more likely a percentage, quantity or SKU fragment than a price.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP', 'HUF', 'ISK']);

// A number immediately followed by one of these is a measurement, not a price.
const UNIT_AFTER = /^\s*(kg|g|mg|ml|cl|l|oz|lb|lbs|cm|mm|m|km|kwh|pc|pcs|pk|ct|pack)\b/i;

/**
 * Parse a numeric string with unknown grouping/decimal conventions.
 * Returns a Number, or NaN if it isn't a sane number.
 */
export function parseNumber(input) {
  if (input == null) return NaN;
  let s = String(input).trim();
  // Drop spaces, non-breaking spaces and apostrophes used as grouping.
  s = s.replace(/[\s  '’]/g, '');
  if (!/[0-9]/.test(s)) return NaN;
  // Keep only digits and separators.
  s = s.replace(/[^0-9.,]/g, '');
  if (s === '') return NaN;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // The right-most separator is the decimal point; the other is grouping.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const groupSep = decimalSep === ',' ? '.' : ',';
    s = s.split(groupSep).join('').replace(decimalSep, '.');
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = s.split(sep);
    if (parts.length > 2) {
      // Repeated separator -> pure grouping: 1.234.567 / 1,234,567
      s = parts.join('');
    } else {
      const after = parts[1] || '';
      // 3 trailing digits with a leading group -> thousands (1,500 / 1.500).
      // Otherwise treat the separator as a decimal point (12,50 / 3.49 / 1.5).
      if (after.length === 3 && parts[0].length >= 1) {
        s = parts.join('');
      } else {
        s = parts[0] + '.' + after;
      }
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Resolve a detected symbol to a concrete ISO code, using an optional hint. */
function resolveCurrency(symbol, isoInText, hintCurrency) {
  if (isoInText && ISO_CODES.has(isoInText)) return isoInText;
  if (!symbol) return hintCurrency && ISO_CODES.has(hintCurrency) ? hintCurrency : null;
  const family = SYMBOL_FAMILIES[symbol];
  if (!family) return null;
  // If the hint belongs to this symbol's family, honour it (e.g. $ + shop=CAD).
  if (hintCurrency && family.includes(hintCurrency)) return hintCurrency;
  return family[0];
}

/**
 * Extract the most likely price from an OCR string.
 * @param {string} text raw OCR output
 * @param {object} opts
 *   shopCurrency: currency of the place you're standing in
 *   strict: require positive price evidence (currency symbol, ISO code or
 *     decimal minor units; bare integers allowed only in zero-decimal
 *     currencies). Use for noisy sources like live camera OCR, where a naked
 *     number is more often a percentage/quantity/code than a price.
 * @returns {{ value:number, currency:string|null, symbol:string|null, raw:string } | null}
 */
export function parsePrice(text, opts = {}) {
  if (!text) return null;
  const hint = opts.shopCurrency || null;
  const strict = !!opts.strict;
  const cleaned = String(text).replace(/[  ]/g, ' ');

  // Find every number-like token together with its surrounding characters so we
  // can associate a currency symbol sitting just before or after it.
  // Spaces join digits ONLY as thousands grouping (“1 234,56”). A loose
  // space class would glue unrelated numbers on OCR-merged lines
  // (“818103  1,31” → 8 million) — the source of barcode-sized “prices”.
  const numRe = /(\d{1,3}(?:[ \u00A0\u2009]\d{3})+(?:[.,]\d+)?|\d[\d.,'\u2019]*\d|\d)/g;
  const candidates = [];
  let m;
  while ((m = numRe.exec(cleaned)) !== null) {
    const rawNum = m[0];
    const start = m.index;
    const end = start + rawNum.length;
    const before = cleaned.slice(Math.max(0, start - 8), start);
    const after = cleaned.slice(end, end + 8);

    // A percentage is not a price ("40% RECYCLED POLYESTER", "SAVE 20 %").
    if (/^\s*%/.test(after)) continue;
    // Neither is a plain unit quantity ("500g", "1.5 L") unless a currency
    // symbol anchors it as money.
    if (UNIT_AFTER.test(after) && !/[€£$¥₩₹฿₫₴₪₱]/.test(before)) continue;
    // Digit groups linked by dashes or slashes are codes, not money:
    // barcodes ("006-28110-14602"), dates ("2026/03/11"), ranges.
    if (/\d[-/]$/.test(before.replace(/\s+$/, '')) || /^[-/]\s*\d/.test(after.replace(/^\s+/, ''))) continue;

    const value = parseNumber(rawNum);
    if (!Number.isFinite(value) || value <= 0) continue;

    // Look for a currency symbol immediately before (preferred) or after.
    // "After" must be ADJACENT (≤2 chars away): on OCR-merged lines like
    // "818103  1,31 $" the $ belongs to 1,31, and a loose window would let
    // the barcode fragment steal it as price evidence.
    let symbol = null;
    for (const tok of SYMBOL_TOKENS) {
      if (before.trimEnd().endsWith(tok)) { symbol = tok; break; }
    }
    if (!symbol) {
      for (const tok of SYMBOL_TOKENS) {
        const head = after.slice(0, tok.length + 2);
        if (head.trimStart().startsWith(tok) && (head.length - head.trimStart().length) <= 2) { symbol = tok; break; }
      }
    }
    // A 3-letter ISO code near the number (e.g. "19.95 CHF").
    const isoMatch = (before + ' ' + after).toUpperCase().match(/\b([A-Z]{3})\b/);
    const iso = isoMatch && ISO_CODES.has(isoMatch[1]) ? isoMatch[1] : null;

    // Does the number look like a real price (has a decimal or a symbol)?
    const hasDecimal = /[.,]\d{1,2}\b/.test(rawNum) && value < 100000;
    candidates.push({ value, symbol, iso, hasDecimal, raw: rawNum.trim() });
  }

  // Strict mode: demand positive evidence of price-ness, and a plausible
  // magnitude — a 34-million grocery price is a barcode, not money. A bare
  // integer only qualifies where whole-number prices are the norm
  // (zero-decimal currency).
  const maxPlausible = ZERO_DECIMAL.has(hint) ? 10_000_000 : 99_999.99;
  const pool = strict
    ? candidates.filter((c) =>
        (c.symbol || c.iso || c.hasDecimal || ZERO_DECIMAL.has(hint)) && c.value <= maxPlausible)
    : candidates;

  if (pool.length === 0) return null;

  // Rank: symbol/ISO match first, then decimal-looking, then a sane magnitude.
  pool.sort((a, b) => {
    const score = (c) =>
      (c.symbol || (c.iso && ISO_CODES.has(c.iso)) ? 100 : 0) +
      (c.hasDecimal ? 20 : 0) +
      (c.value >= 0.1 && c.value < 100000 ? 5 : 0);
    return score(b) - score(a);
  });

  const best = pool[0];
  const currency = resolveCurrency(best.symbol, best.iso, hint);
  return { value: best.value, currency, symbol: best.symbol || null, raw: best.raw };
}

/* ============================================================
   selectPrices — turn OCR lines into the prices worth showing.
   Shared by the live Lens (converter/lens.js) and the regression
   harness (tools/lens-eval.mjs) so both exercise identical logic.

   Beyond per-line strict parsing, this applies layout intelligence:
   - BIG-PRINT PRIORITY: tags print THE price large and everything
     else (unit prices, codes, weights) small. Lines shorter than
     55% of the tallest priced line are dropped. Menus, where all
     lines are similar height, keep everything.
   - Per-unit prices ("1,31 $ / 100 ml") lose to the main price.
   ============================================================ */
const UNIT_PRICE_LINE = /\/\s*\d*\s*(ml|cl|l|g|kg|lb|lbs|oz|ea|un|unit|pc|pcs|each)\b/i;

// Lines whose price is CONTEXT, not the asking price: discount amounts
// ("RABAIS 270,00"), was-prices ("était 949,99", "prix courant 969,99",
// "REG 949.99"), and bundled fees ("inclus ENV 1,30", deposits). Real
// shelf labels put these in smaller print, but OCR height alone isn't
// always enough — the words are the reliable signal.
// \br[ée]g\b covers "REG 949.99" AND the accented "Notre prix rég. 129⁹⁹"
// (the Sports Experts decoy line that used to win the green box).
const CONTEXT_PRICE_LINE = /(rabais|était|etait|prix\s*cour|notre\s*prix|ancien|économis|economis|\bsave\b|\bwas\b|\br[ée]g\b|régulier|regulier|courant|inclus|\benv\b|consigne|deposit)/i;

/**
 * Stitch superscript cents back onto their price. Electronic shelf labels
 * and big-print tags write "699⁹⁹": a huge integer with tiny top-aligned
 * cents and NO separator. OCR returns them as separate bare integers, and
 * strict evidence (rightly) rejects bare integers — so the REAL price
 * vanishes and a smaller "RABAIS 270,00" or fee line wins. This repairs
 * the pair into "699.99" before parsing.
 * Two forms:
 *  - separate lines: a small (18–80% of big height), top-aligned, exactly-
 *    2-digit line horizontally adjacent to a line ending in a bare integer;
 *  - same line: "699 99" at the very end of a line with no other decimals.
 */
export function stitchCents(lines, words, pctSyms) {
  if (!lines || !lines.length) return lines || [];
  const out = lines.map((l) => ({ ...l }));
  const isCents = (t) => /^\s*\d{2}\s*$/.test(t || '');
  const centerIn = (b, box) => {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return cx >= box.x0 && cx <= box.x1 && cy >= box.y0 && cy <= box.y1;
  };
  // A "%" that is actually superscript cents: Tesseract misreads the tiny
  // raised "99" as a percent sign ("79⁹⁹" → "79%"), and the percent guard
  // then kills the real price. The tell is geometry: a REAL percent sign is
  // near line height and sits on the baseline ("Rabais 40%" → 73–92% of the
  // line box); misread cents are small (≈35–40%) and float high. Strip the
  // impostor so the dollars survive as an integer (exact cents are
  // unreadable at this point — the dominant-integer rescue shows .00).
  for (const l of out) {
    if (!l.text || !l.bbox || !/\d\s*%\s*$/.test(l.text)) continue;
    const lh = l.bbox.y1 - l.bbox.y0;
    if (!(lh > 0)) continue;
    for (const ps of pctSyms || []) {
      if (!ps || !ps.x0 && ps.x0 !== 0) continue;
      const cx = (ps.x0 + ps.x1) / 2, cy = (ps.y0 + ps.y1) / 2;
      if (cx < l.bbox.x0 + 0.5 * (l.bbox.x1 - l.bbox.x0)) continue; // right end only
      if (cx > l.bbox.x1 + 4 || cy < l.bbox.y0 || cy > l.bbox.y1) continue; // inside this line
      const sh = ps.y1 - ps.y0;
      if (sh >= 0.55 * lh) continue;                    // near-full height → real %
      if (l.bbox.y1 - ps.y1 < 0.25 * lh) continue;      // on the baseline → real %
      l.text = l.text.replace(/\s*%\s*$/, '');
      break;
    }
  }
  // Superscript candidates: standalone 2-digit lines, plus 2-digit WORDS
  // living inside unrelated lines — sparse-text OCR loves gluing a
  // superscript onto whatever text row sits at the same height (the real
  // DeWalt tag came back as "RABOT DEWALT 13 99" + a separate "699").
  const sups = [];
  for (const l of out) if (isCents(l.text) && l.bbox) sups.push({ text: l.text.trim(), bbox: l.bbox, confidence: l.confidence, line: l });
  for (const w of words || []) if (w && isCents(w.text) && w.bbox) sups.push({ text: String(w.text).trim(), bbox: w.bbox, confidence: w.confidence, word: true });
  // The big half: a line that IS a bare integer (optional currency symbol).
  // TWO digits minimum: in the field, stray single-digit fragments (a "9"
  // clipped out of "79") were grabbing loose "00" words from product-code
  // boxes and inventing CA$9.00 prices.
  const bigs = out
    .filter((l) => l.bbox && /^\s*[€£$¥₩₹฿]?\s*\d{2,5}\s*$/.test(l.text || ''))
    .sort((a, b) => (b.bbox.y1 - b.bbox.y0) - (a.bbox.y1 - a.bbox.y0)); // tallest claims first
  for (const big of bigs) {
    const bh = big.bbox.y1 - big.bbox.y0;
    if (!(bh > 0)) continue;
    const bw = big.bbox.x1 - big.bbox.x0;
    const bcx = (big.bbox.x0 + big.bbox.x1) / 2;
    // "$129" + "99" — when OCR loses the dot in "$129.99" the cents are the
    // SAME height, not superscript. The currency symbol already proves the
    // line is money, so same-height cents are allowed to reattach.
    const hasSym = /[€£$¥₩₹฿]/.test(big.text);
    let best = null, bestGap = Infinity;
    for (const s of sups) {
      if (s.used || s.line === big) continue;
      const sh = s.bbox.y1 - s.bbox.y0;
      if (!(sh >= 0.15 * bh && sh <= (hasSym ? 1.15 : 0.85) * bh)) continue; // smaller print (unless symbol-anchored)
      // Horizontally: hugging the big number's RIGHT end. Sparse-text boxes
      // are inflated (the big line's box often already covers the cents), so
      // edge-gap math is unreliable — use box relations instead.
      if (s.bbox.x0 < bcx) continue;                        // right half only
      if (s.bbox.x1 < big.bbox.x1 - 0.15 * bw) continue;    // reaches the right end
      if (s.bbox.x0 > big.bbox.x1 + 1.6 * sh) continue;     // ...but not far past it
      // Vertically: overlapping and top-aligned (superscript, not baseline).
      if (s.bbox.y1 <= big.bbox.y0 || s.bbox.y0 >= big.bbox.y1) continue;
      if (s.bbox.y0 > big.bbox.y0 + 0.55 * bh) continue;
      if (s.bbox.y1 > big.bbox.y1 + 0.25 * bh) continue;
      const gap = Math.abs(s.bbox.x0 - big.bbox.x1);
      if (gap < bestGap) { bestGap = gap; best = s; }
    }
    if (!best) continue;
    best.used = true;
    big.text = big.text.replace(/\s*$/, '') + '.' + best.text;
    big.bbox = {
      x0: Math.min(big.bbox.x0, best.bbox.x0), y0: Math.min(big.bbox.y0, best.bbox.y0),
      x1: Math.max(big.bbox.x1, best.bbox.x1), y1: Math.max(big.bbox.y1, best.bbox.y1),
    };
    big.height = Math.max(big.height || 0, bh);
    // Giant sparse-text digits often carry a bogus 0 line confidence while
    // the underlying WORDS score fine — trust the strongest member. (Only
    // when someone actually reported one: absent stays absent.)
    const confs = [big.confidence, best.confidence];
    for (const w of words || []) {
      if (w && w.bbox && /^\d{1,5}$/.test(String(w.text || '').trim()) && centerIn(w.bbox, big.bbox)) {
        confs.push(w.confidence);
      }
    }
    const known = confs.filter((c) => typeof c === 'number');
    if (known.length) big.confidence = Math.max(...known);
    if (best.line) {
      best.line.__consumed = true;
    } else {
      // The cents word was glued into another line — strip it there so the
      // leftover "PRODUCT NAME 99" can't fake a price later.
      for (const l of out) {
        if (l === big || !l.bbox || !l.text) continue;
        if (!centerIn(best.bbox, l.bbox)) continue;
        const re = new RegExp('\\s*' + best.text + '\\s*$');
        if (re.test(l.text)) l.text = l.text.replace(re, '');
      }
    }
  }
  // Same-line variant: OCR merged the pair into ONE pure-number line
  // ("699 99"). Only pure pairs — a trailing "13 99" inside a product-name
  // line is more likely a glued superscript belonging to a neighbour.
  for (const l of out) {
    if (l.__consumed || !l.text) continue;
    l.text = l.text.replace(/^(\s*[€£$¥₩₹฿]?\s*\d{1,5})[ \u00A0]{1,2}(\d{2})\s*$/, '$1.$2');
  }
  return out.filter((l) => !l.__consumed);
}

/**
 * Parse EVERY priced line into an item — no size filtering, no ranking.
 * The Lens caches this full set per frame so a tap can be answered from
 * memory instantly, even for prices the big-print rule would hide.
 * @param {Array<{text:string, confidence?:number, height?:number, bbox?:object}>} lines
 *   OCR lines in top-to-bottom order (height = bbox pixel height; bbox is
 *   passed through untouched for overlay positioning).
 * @param {object} opts shopCurrency, minConfidence=30
 * @returns {Array<{value:number, currency:string|null, raw:string, height:number, unitPrice:boolean, bbox:object|null, order:number}>}
 */
export function collectPrices(lines, opts = {}) {
  const minConf = opts.minConfidence == null ? 30 : opts.minConfidence;
  const stitched = stitchCents(lines, opts.words, opts.pctSyms);
  const items = [];
  let idx = 0;
  for (const ln of stitched) {
    if (!ln || !ln.text) continue;
    if (ln.confidence != null && ln.confidence < minConf) continue;
    const parsed = parsePrice(ln.text, { shopCurrency: opts.shopCurrency, strict: true });
    if (!parsed || !(parsed.value > 0)) continue;
    items.push({
      value: parsed.value,
      currency: parsed.currency,
      raw: parsed.raw,
      height: ln.height || 0,
      unitPrice: UNIT_PRICE_LINE.test(ln.text),
      contextPrice: CONTEXT_PRICE_LINE.test(ln.text),
      bbox: ln.bbox || null,
      order: idx++,
    });
  }
  // DOMINANT-INTEGER RESCUE. Sometimes OCR simply never sees the tiny
  // superscript cents (it discards them as noise beside 100px digits), so
  // the giant "699" stays a bare integer and strict evidence rejects it —
  // leaving a small discount/fee line as the only "price" on the tag.
  // Two shapes of evidence unlock it:
  // - an evidenced price exists somewhere on the tag, and the integer
  //   towers ≥1.8× above every evidenced line; or
  // - NO price is evidenced anywhere (all cents were unreadable) but the
  //   frame is tag-like — several lines of text — and the integer towers
  //   ≥1.8× above every OTHER text line. A lone giant "40" on a sign stays
  //   rejected (too few lines); menus/receipts fail the height ratio.
  // Confidence is ignored here — Tesseract reports bogus 0s for giant
  // digits — the structure (pure short integer, dominant height) is the
  // evidence.
  if (!ZERO_DECIMAL.has(opts.shopCurrency)) {
    const hadEvidence = items.length > 0;
    const maxPricedH = hadEvidence ? Math.max(...items.map((i) => i.height)) : 0;
    const textLines = stitched.filter((l) => l && l.text && /\S/.test(l.text));
    for (const ln of stitched) {
      if (!ln || !ln.text) continue;
      if (!/^\s*[€£$¥₩₹฿]?\s*\d{2,6}\s*$/.test(ln.text)) continue;
      if (hadEvidence) {
        if (!(ln.height >= 1.8 * maxPricedH && maxPricedH > 0)) continue;
      } else {
        if (textLines.length < 4) continue; // not tag-like enough
        const maxOtherH = Math.max(...textLines.filter((o) => o !== ln).map((o) => o.height || 0));
        if (!(maxOtherH > 0 && ln.height >= 1.8 * maxOtherH)) continue;
      }
      const value = parseNumber(ln.text);
      if (!Number.isFinite(value) || value < 10 || value > 99999) continue;
      items.push({
        value,
        currency: opts.shopCurrency || null,
        raw: ln.text.trim(),
        height: ln.height || 0,
        unitPrice: false,
        contextPrice: false,
        bbox: ln.bbox || null,
        order: idx++,
        dominantInt: true,
      });
    }
  }
  return items;
}

/**
 * Rank pre-collected items (from collectPrices) into what's worth showing.
 * @param {object} opts
 *   maxItems=6
 *   target: {x, y} in the same coordinate space as the item bboxes — when
 *     set (user tapped a spot), the price whose line is NEAREST the target
 *     is returned alone, overriding size ranking. Camera-style tap-to-focus.
 */
export function selectFromItems(items, opts = {}) {
  const maxItems = opts.maxItems || 6;
  if (!items || !items.length) return [];

  // Tap-to-target: the user pointed at a specific number — honour it above
  // every other rule and return just that price.
  if (opts.target && items.some((i) => i.bbox)) {
    const { x, y } = opts.target;
    const dist = (i) => {
      if (!i.bbox) return Infinity;
      const cx = (i.bbox.x0 + i.bbox.x1) / 2, cy = (i.bbox.y0 + i.bbox.y1) / 2;
      return Math.hypot(cx - x, cy - y);
    };
    items.sort((a, b) => dist(a) - dist(b));
    return items.slice(0, 1);
  }

  // PRIMARY RULE — big print wins: on real-world tags the largest numeric
  // text is almost always THE price. Lines under 60% of the tallest priced
  // line are dropped, and the remainder is ranked tallest-first (heights
  // within 15% count as equal so equal-size menus keep reading order).
  const maxH = Math.max(...items.map((i) => i.height));
  let kept = maxH > 0 ? items.filter((i) => i.height >= 0.6 * maxH) : items;
  // The main price beats per-unit small print.
  if (kept.some((i) => !i.unitPrice)) kept = kept.filter((i) => !i.unitPrice);
  // …and beats discount/was-price/fee lines ("RABAIS 270,00", "était
  // 949,99", "inclus ENV 1,30") whenever a non-context price is in view.
  if (kept.some((i) => !i.contextPrice)) kept = kept.filter((i) => !i.contextPrice);
  if (maxH > 0) {
    kept.sort((a, b) => {
      if (Math.abs(a.height - b.height) <= 0.15 * maxH) return a.order - b.order;
      return b.height - a.height;
    });
  }
  return kept.slice(0, maxItems);
}

/**
 * OCR lines -> the prices worth showing. Convenience wrapper combining
 * collectPrices + selectFromItems; the Lens calls the two halves separately
 * so it can cache the full item set for instant tap answers.
 */
export function selectPrices(lines, opts = {}) {
  return selectFromItems(collectPrices(lines, opts), opts);
}

export default parsePrice;
