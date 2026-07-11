/* ============================================================
   convert — currency metadata, live rates, conversion, formatting.
   Shared by the Convert tool, the Lens overlay, Tips and Wallet.
   ============================================================ */

export const CURRENCIES = {
  USD: { name: 'US Dollar',            symbol: '$',   flag: '🇺🇸' },
  EUR: { name: 'Euro',                 symbol: '€',   flag: '🇪🇺' },
  GBP: { name: 'British Pound',        symbol: '£',   flag: '🇬🇧' },
  JPY: { name: 'Japanese Yen',         symbol: '¥',   flag: '🇯🇵' },
  CNY: { name: 'Chinese Yuan',         symbol: '¥',   flag: '🇨🇳' },
  AUD: { name: 'Australian Dollar',    symbol: 'A$',  flag: '🇦🇺' },
  CAD: { name: 'Canadian Dollar',      symbol: 'C$',  flag: '🇨🇦' },
  CHF: { name: 'Swiss Franc',          symbol: 'Fr',  flag: '🇨🇭' },
  INR: { name: 'Indian Rupee',         symbol: '₹',   flag: '🇮🇳' },
  MXN: { name: 'Mexican Peso',         symbol: 'Mex$',flag: '🇲🇽' },
  BRL: { name: 'Brazilian Real',       symbol: 'R$',  flag: '🇧🇷' },
  KRW: { name: 'South Korean Won',     symbol: '₩',   flag: '🇰🇷' },
  SGD: { name: 'Singapore Dollar',     symbol: 'S$',  flag: '🇸🇬' },
  HKD: { name: 'Hong Kong Dollar',     symbol: 'HK$', flag: '🇭🇰' },
  NZD: { name: 'New Zealand Dollar',   symbol: 'NZ$', flag: '🇳🇿' },
  SEK: { name: 'Swedish Krona',        symbol: 'kr',  flag: '🇸🇪' },
  NOK: { name: 'Norwegian Krone',      symbol: 'kr',  flag: '🇳🇴' },
  DKK: { name: 'Danish Krone',         symbol: 'kr',  flag: '🇩🇰' },
  ISK: { name: 'Icelandic Króna',      symbol: 'kr',  flag: '🇮🇸' },
  PLN: { name: 'Polish Złoty',         symbol: 'zł',  flag: '🇵🇱' },
  CZK: { name: 'Czech Koruna',         symbol: 'Kč',  flag: '🇨🇿' },
  HUF: { name: 'Hungarian Forint',     symbol: 'Ft',  flag: '🇭🇺' },
  RON: { name: 'Romanian Leu',         symbol: 'lei', flag: '🇷🇴' },
  THB: { name: 'Thai Baht',            symbol: '฿',   flag: '🇹🇭' },
  VND: { name: 'Vietnamese Đồng',      symbol: '₫',   flag: '🇻🇳' },
  IDR: { name: 'Indonesian Rupiah',    symbol: 'Rp',  flag: '🇮🇩' },
  MYR: { name: 'Malaysian Ringgit',    symbol: 'RM',  flag: '🇲🇾' },
  PHP: { name: 'Philippine Peso',      symbol: '₱',   flag: '🇵🇭' },
  TWD: { name: 'Taiwan Dollar',        symbol: 'NT$', flag: '🇹🇼' },
  ZAR: { name: 'South African Rand',   symbol: 'R',   flag: '🇿🇦' },
  TRY: { name: 'Turkish Lira',         symbol: '₺',   flag: '🇹🇷' },
  AED: { name: 'UAE Dirham',           symbol: 'د.إ', flag: '🇦🇪' },
  SAR: { name: 'Saudi Riyal',          symbol: '﷼',   flag: '🇸🇦' },
  ILS: { name: 'Israeli Shekel',       symbol: '₪',   flag: '🇮🇱' },
  EGP: { name: 'Egyptian Pound',       symbol: 'E£',  flag: '🇪🇬' },
  MAD: { name: 'Moroccan Dirham',      symbol: 'DH',  flag: '🇲🇦' },
  ARS: { name: 'Argentine Peso',       symbol: '$',   flag: '🇦🇷' },
  CLP: { name: 'Chilean Peso',         symbol: '$',   flag: '🇨🇱' },
  COP: { name: 'Colombian Peso',       symbol: '$',   flag: '🇨🇴' },
  PEN: { name: 'Peruvian Sol',         symbol: 'S/',  flag: '🇵🇪' },
  UAH: { name: 'Ukrainian Hryvnia',    symbol: '₴',   flag: '🇺🇦' },
};

// Offline fallback rates (units per 1 USD). Approximate — used only if the
// live fetch fails so the app is always useful, even with no signal abroad.
export const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 157, CNY: 7.24, AUD: 1.50, CAD: 1.36,
  CHF: 0.89, INR: 83.3, MXN: 17.1, BRL: 5.43, KRW: 1370, SGD: 1.34, HKD: 7.81,
  NZD: 1.63, SEK: 10.5, NOK: 10.7, DKK: 6.86, ISK: 138, PLN: 3.97, CZK: 23.1,
  HUF: 358, RON: 4.57, THB: 36.2, VND: 25400, IDR: 16200, MYR: 4.71, PHP: 57.5,
  TWD: 32.4, ZAR: 18.4, TRY: 32.2, AED: 3.67, SAR: 3.75, ILS: 3.71, EGP: 47.6,
  MAD: 9.95, ARS: 900, CLP: 945, COP: 3950, PEN: 3.75, UAH: 40.5,
};

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP', 'HUF', 'ISK']);

/** rates: units of X per 1 USD. amount in `from` -> value in `to`. */
export function convert(amount, from, to, rates) {
  if (!Number.isFinite(amount)) return NaN;
  const rf = rates[from], rt = rates[to];
  if (!rf || !rt) return NaN;
  return (amount / rf) * rt;
}

export function unitRate(from, to, rates) {
  return convert(1, from, to, rates);
}

/** Locale-aware currency string. Falls back to a symbol if Intl lacks the code. */
export function formatMoney(value, code) {
  if (!Number.isFinite(value)) value = 0;
  const zero = ZERO_DECIMAL.has(code);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: code,
      minimumFractionDigits: zero ? 0 : 2,
      maximumFractionDigits: zero ? 0 : 2,
    }).format(value);
  } catch {
    const c = CURRENCIES[code];
    const digits = zero ? 0 : 2;
    return (c ? c.symbol : '') + value.toLocaleString(undefined,
      { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}

/**
 * Fetch live ECB rates (base USD) from the keyless Frankfurter API.
 * Returns { rates, date, live }. On any failure returns the fallback table.
 * Browser-only (uses fetch); tests exercise convert()/formatMoney() directly.
 */
export async function fetchRates() {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
    if (!res.ok) throw new Error('status ' + res.status);
    const data = await res.json();
    if (!data || !data.rates) throw new Error('malformed');
    const rates = { USD: 1 };
    for (const code of Object.keys(CURRENCIES)) {
      if (code === 'USD') continue;
      rates[code] = typeof data.rates[code] === 'number' ? data.rates[code] : FALLBACK_RATES[code];
    }
    return { rates, date: data.date || null, live: true };
  } catch (err) {
    return { rates: { ...FALLBACK_RATES }, date: null, live: false, error: err.message };
  }
}
