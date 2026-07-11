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

// Any 3-letter ISO code we recognise as a currency in free text.
const ISO_CODES = new Set([
  'USD','EUR','GBP','JPY','CNY','AUD','CAD','CHF','INR','MXN','BRL','KRW','SGD',
  'HKD','NZD','SEK','NOK','DKK','PLN','THB','ZAR','TRY','AED','PHP','CZK','HUF',
  'ILS','MYR','IDR','VND','ISK','SAR','QAR','RON','CLP','COP','ARS','UAH','TWD','VES',
]);

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
 * @param {object} opts { shopCurrency } currency of the place you're standing in
 * @returns {{ value:number, currency:string|null, symbol:string|null, raw:string } | null}
 */
export function parsePrice(text, opts = {}) {
  if (!text) return null;
  const hint = opts.shopCurrency || null;
  const cleaned = String(text).replace(/[  ]/g, ' ');

  // Find every number-like token together with its surrounding characters so we
  // can associate a currency symbol sitting just before or after it.
  const numRe = /(\d[\d.,'’\s ]*\d|\d)/g;
  const candidates = [];
  let m;
  while ((m = numRe.exec(cleaned)) !== null) {
    const rawNum = m[0];
    const start = m.index;
    const end = start + rawNum.length;
    const before = cleaned.slice(Math.max(0, start - 6), start);
    const after = cleaned.slice(end, end + 6);

    // A percentage or a plain unit quantity is not a price.
    if (/^\s*%/.test(after)) continue;
    if (/^\s*(kg|g|ml|l|oz|lb|cm|mm|km|kwh)\b/i.test(after) && !/[€£$¥₩₹฿]/.test(before)) continue;

    const value = parseNumber(rawNum);
    if (!Number.isFinite(value) || value <= 0) continue;

    // Look for a currency symbol immediately before (preferred) or after.
    let symbol = null;
    for (const tok of SYMBOL_TOKENS) {
      if (before.trimEnd().endsWith(tok)) { symbol = tok; break; }
    }
    if (!symbol) {
      for (const tok of SYMBOL_TOKENS) {
        if (after.trimStart().startsWith(tok)) { symbol = tok; break; }
      }
    }
    // A 3-letter ISO code near the number (e.g. "19.95 CHF").
    const isoMatch = (before + ' ' + after).toUpperCase().match(/\b([A-Z]{3})\b/);
    const iso = isoMatch ? isoMatch[1] : null;

    // Does the number look like a real price (has a decimal or a symbol)?
    const hasDecimal = /[.,]\d{1,2}\b/.test(rawNum) && value < 100000;
    candidates.push({ value, symbol, iso, hasDecimal, raw: rawNum.trim() });
  }

  if (candidates.length === 0) return null;

  // Rank: symbol/ISO match first, then decimal-looking, then a sane magnitude.
  candidates.sort((a, b) => {
    const score = (c) =>
      (c.symbol || (c.iso && ISO_CODES.has(c.iso)) ? 100 : 0) +
      (c.hasDecimal ? 20 : 0) +
      (c.value >= 0.1 && c.value < 100000 ? 5 : 0);
    return score(b) - score(a);
  });

  const best = candidates[0];
  const currency = resolveCurrency(best.symbol, best.iso, hint);
  return { value: best.value, currency, symbol: best.symbol || null, raw: best.raw };
}

export default parsePrice;
