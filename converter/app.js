/* ============================================================
   Roam — app shell, router and tool views.
   Vanilla ES modules, no framework. Every tool works offline;
   only live FX rates and (optional) speech need a connection.
   ============================================================ */

import { CURRENCIES, FALLBACK_RATES, convert, unitRate, formatMoney, fetchRates } from './lib/convert.js';
import { CATEGORIES as UNIT_CATS, convertUnit, pretty } from './lib/units.js';
import { CHARTS, equivalents, regionOptions } from './lib/sizes.js';
import { TIPPING, calcTip } from './lib/tips.js';
import { COUNTRIES, WATER_LABEL, PLUG_INFO } from './lib/countries.js';
import { LANGUAGES, CATEGORIES as PHRASE_CATS, PHRASES } from './lib/phrases.js';
import { createLens, isSecureCameraContext } from './lens.js';
import { APP_VERSION, LENS_VERSION } from './lib/version.js';

/* ---------- state + persistence ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('roam.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('roam.' + k, JSON.stringify(v)); } catch {} },
};
function guessHome() {
  const map = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', IN: 'INR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', BR: 'BRL', MX: 'MXN', KR: 'KRW', SG: 'SGD', ZA: 'ZAR' };
  try {
    const region = (new Intl.Locale(navigator.language).region) || (navigator.language.split('-')[1] || '').toUpperCase();
    if (map[region]) return map[region];
    if (['DE','FR','ES','IT','NL','IE','PT','AT','BE','GR','FI'].includes(region)) return 'EUR';
  } catch {}
  return 'USD';
}
const state = {
  home: store.get('home', guessHome()),
  shop: store.get('shop', 'EUR'),
  dest: store.get('dest', null), // country code — the trip destination
  rates: { ...FALLBACK_RATES }, ratesLive: false, ratesDate: null,
  wallet: store.get('wallet', []),
  cvHistory: store.get('cvHistory', []),
};
function setHome(c) { state.home = c; store.set('home', c); }
function setShop(c) { state.shop = c; store.set('shop', c); }
function setDest(code) {
  state.dest = code || null;
  store.set('dest', state.dest);
  // The destination drives the app: its currency becomes the shop currency
  // used by Lens, Convert, Tips and Wallet.
  if (state.dest && COUNTRIES[state.dest]) setShop(COUNTRIES[state.dest].currency);
}

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);
const view = $('view');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function currencyOptions(sel) {
  return Object.keys(CURRENCIES).map((c) =>
    `<option value="${c}" ${c === sel ? 'selected' : ''}>${CURRENCIES[c].flag}  ${c} · ${esc(CURRENCIES[c].name)}</option>`).join('');
}
function destOptions(sel) {
  const codes = Object.keys(COUNTRIES).sort((a, b) => COUNTRIES[a].name.localeCompare(COUNTRIES[b].name));
  return `<option value="">🌍  Choose a destination…</option>` + codes.map((c) =>
    `<option value="${c}" ${c === sel ? 'selected' : ''}>${COUNTRIES[c].flag}  ${esc(COUNTRIES[c].name)}</option>`).join('');
}
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : NaN; }

/* ---------- rates ---------- */
async function loadRates() {
  const r = await fetchRates();
  state.rates = r.rates; state.ratesLive = r.live; state.ratesDate = r.date;
  document.querySelectorAll('[data-rate-status]').forEach(refreshRateStatus);
  if (location.hash === '#/convert' || location.hash === '' || location.hash === '#/') rerenderIfActive('convert');
}
function refreshRateStatus(el) {
  const dot = el.querySelector('.dot'); const txt = el.querySelector('[data-rate-text]');
  if (dot) dot.classList.toggle('stale', !state.ratesLive);
  if (txt) txt.textContent = state.ratesLive ? (state.ratesDate ? 'Live · ' + state.ratesDate : 'Live rates') : 'Offline rates';
}

/* ============================================================
   VIEWS  — each returns { html, mount? }
   ============================================================ */
const TOOLS = [
  { key: 'lens', route: '#/lens', emoji: '🔍', name: 'Lens', sub: 'Scan any price tag with your camera', flag: true },
  { key: 'convert', route: '#/convert', emoji: '💱', name: 'Convert', sub: 'Currency at live rates' },
  { key: 'units', route: '#/units', emoji: '📐', name: 'Units', sub: 'Miles, °F, lbs & more' },
  { key: 'tips', route: '#/tips', emoji: '🧾', name: 'Tips & split', sub: 'What to tip, by country' },
  { key: 'sizes', route: '#/sizes', emoji: '👟', name: 'Sizes', sub: 'Clothes & shoes abroad' },
  { key: 'phrasebook', route: '#/phrasebook', emoji: '💬', name: 'Phrasebook', sub: '8 languages, offline' },
  { key: 'essentials', route: '#/essentials', emoji: '🧭', name: 'Essentials', sub: 'Emergency, plugs, water' },
  { key: 'wallet', route: '#/wallet', emoji: '👛', name: 'Wallet', sub: 'Track trip spending' },
];

// Destination briefing card for the home screen. With no destination set it
// invites the traveller to pick one; with one set it shows the essentials
// at a glance and quick actions tuned to that country.
function destCardHTML() {
  if (!state.dest || !COUNTRIES[state.dest]) {
    return `
    <div class="glass" style="padding:16px;margin-bottom:16px">
      <div style="font-weight:800;font-size:18px;margin-bottom:4px">🌍 Where are you headed?</div>
      <p class="muted" style="font-size:13.5px;margin:0 0 12px">Pick a destination and every tool — Lens, money, tips, phrases, essentials — tunes itself to it.</p>
      <select id="homeDest" class="sel" aria-label="Choose destination">${destOptions('')}</select>
    </div>`;
  }
  const c = COUNTRIES[state.dest];
  const em = c.emergency;
  const emTxt = em.all || [em.police, em.ambulance].filter(Boolean).join(' / ');
  const w = WATER_LABEL[c.water];
  const r = unitRate(state.home, c.currency, state.rates);
  const langName = c.lang && LANGUAGES[c.lang] ? LANGUAGES[c.lang].name : null;
  const tip = TIPPING[state.dest];
  return `
  <div class="glass" style="padding:16px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:32px">${c.flag}</span>
      <div style="flex:1;min-width:0">
        <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;opacity:.6">Travelling to</div>
        <div style="font-weight:800;font-size:21px;letter-spacing:-0.02em">${esc(c.name)}</div>
      </div>
      <button id="changeDest" class="chip">Change</button>
    </div>
    <div class="row-list" style="margin-top:6px">
      <div><span class="muted">💱 Money</span><strong>1 ${state.home} ≈ ${formatMoney(r, c.currency)}</strong></div>
      <div><span class="muted">🚨 Emergency</span><strong>${emTxt}</strong></div>
      <div><span class="muted">🔌 Power</span><strong>${c.plugs.map((p) => 'Type ' + p).join(', ')} · ${c.voltage}V</strong></div>
      <div><span class="muted">💧 Tap water</span><span class="chip pill-${w.tone}" style="cursor:default">${c.water}</span></div>
      <div><span class="muted">🚗 Driving</span><strong>${c.drive === 'left' ? 'Left side' : 'Right side'}</strong></div>
      ${tip ? `<div><span class="muted">🧾 Tipping</span><strong>${tip.pct[1] > 0 ? '~' + tip.pct[1] + '%' : 'Not expected'}</strong></div>` : ''}
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn-primary" data-nav="#/lens" style="padding:11px 18px;font-size:14px">🔍 Scan prices</button>
      <button class="btn-ghost" data-nav="#/essentials" style="padding:11px 16px;font-size:13.5px">Full guide</button>
      ${langName ? `<button class="btn-ghost" data-nav="#/phrasebook" style="padding:11px 16px;font-size:13.5px">Speak ${langName}</button>` : ''}
    </div>
  </div>`;
}

function viewHome() {
  const tiles = TOOLS.map((t) => t.flag ? `
    <button class="tile flag" data-nav="${t.route}">
      <div class="row">
        <div><div class="emoji">${t.emoji}</div><div class="t-name" style="font-size:19px;margin-top:4px">${t.name} — point &amp; price</div>
          <div class="t-sub" style="max-width:30ch">${t.sub}. Live, in your home currency — no photos, no typing.</div></div>
        <div class="btn-primary" style="pointer-events:none">Scan</div>
      </div>
    </button>` : `
    <button class="tile" data-nav="${t.route}">
      <div class="emoji">${t.emoji}</div>
      <div class="t-name">${t.name}</div><div class="t-sub">${t.sub}</div>
    </button>`).join('');
  return { html: `
    <div class="fade-up">
      <div style="padding:8px 2px 18px">
        <h1 style="font-size:clamp(2rem,8vw,2.8rem); font-weight:800; letter-spacing:-0.03em; line-height:1.05; margin:0">
          Anywhere, <span class="serif">made</span> effortless.</h1>
        <p class="muted" style="margin:10px 0 0; font-size:15px; max-width:40ch">Your pocket companion for travel — scanning prices, converting anything, and speaking the language.</p>
        <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap">
          <span class="stat" data-rate-status><span class="dot"></span><span data-rate-text>Rates…</span></span>
          <span class="stat">🏠 Home · ${state.home}</span>
        </div>
      </div>
      ${destCardHTML()}
      <div class="tile-grid">${tiles}</div>
      <p class="muted" style="text-align:center; font-size:12px; margin-top:22px">Roam ${APP_VERSION} · Works offline · installable · a Borealis Design experiment</p>
    </div>` , mount() {
      document.querySelectorAll('[data-rate-status]').forEach(refreshRateStatus);
      const hd = document.getElementById('homeDest');
      if (hd) hd.addEventListener('change', (e) => { setDest(e.target.value); renderRoute(); });
      const cd = document.getElementById('changeDest');
      if (cd) cd.addEventListener('click', openMenu);
    } };
}

function viewConvert() {
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 14px">Convert</h2>
    <div class="glass" style="padding:16px">
      <div class="field" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <label>You have</label><span class="muted" id="cvFromName" style="font-size:12px"></span></div>
        <div style="display:flex;gap:12px;align-items:center">
          <input id="cvAmount" class="num-input" type="number" inputmode="decimal" min="0" step="any" value="100" />
          <select id="cvFrom" class="sel" style="width:160px;flex:0 0 auto"></select>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin:-2px 0"><button id="cvSwap" class="swap-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 4v13M7 4L3 8M7 4l4 4M17 20V7M17 20l4-4M17 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="field">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <label>They want</label><span class="muted" id="cvToName" style="font-size:12px"></span></div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="flex:1;min-width:0"><div class="big-out" id="cvResult">—</div></div>
          <select id="cvTo" class="sel" style="width:160px;flex:0 0 auto"></select>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px">
        <span class="stat" data-rate-status><span class="dot"></span><span data-rate-text>Rates…</span></span>
        <span class="muted" id="cvRate" style="font-size:13px"></span>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">
      <span class="muted" style="font-size:12px;align-self:center">Quick:</span>
      ${[1,5,20,50,100].map((a) => `<button class="chip" data-amt="${a}">${a}</button>`).join('')}
    </div>
    <div style="margin-top:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:0 2px">
        <span class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:700;opacity:.6">History</span>
        <button class="chip" id="cvHistClear" style="font-size:12px;padding:6px 12px">Clear</button>
      </div>
      <div class="glass" id="cvHist" style="padding:4px 16px"></div>
    </div>
  </div>`;
  function mount() {
    const amount = $('cvAmount'), from = $('cvFrom'), to = $('cvTo');
    from.innerHTML = currencyOptions(state.shop); to.innerHTML = currencyOptions(state.home);

    const timeAgo = (ts) => {
      const d = Date.now() - ts;
      if (d < 60e3) return 'just now';
      if (d < 3600e3) return Math.floor(d / 60e3) + 'm ago';
      if (d < 86400e3) return Math.floor(d / 3600e3) + 'h ago';
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    const renderHist = () => {
      const h = state.cvHistory;
      $('cvHistClear').style.display = h.length ? '' : 'none';
      $('cvHist').innerHTML = h.length ? h.map((e, i) => `
        <button class="cvh-row" data-h="${i}" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 0;border:0;background:transparent;color:#fff;cursor:pointer;text-align:left;font-family:inherit;border-bottom:1px solid var(--border)">
          <span style="flex:1;min-width:0;font-size:14.5px;font-weight:600">${e.amount.toLocaleString()} ${e.from} → <strong>${esc(e.result)}</strong></span>
          <span class="muted" style="font-size:11.5px;flex:0 0 auto">${timeAgo(e.ts)}</span>
        </button>`).join('')
        : `<p class="muted" style="font-size:13px;padding:12px 0;margin:0;text-align:center">Your conversions will appear here.</p>`;
      $('cvHist').querySelectorAll('.cvh-row').forEach((b) => {
        if (b.nextElementSibling === null) b.style.borderBottom = '0';
        b.addEventListener('click', () => {
          const e = state.cvHistory[num(b.dataset.h)];
          if (!e) return;
          interacted = true; // re-referencing bumps the entry back to the top
          amount.value = e.amount; from.value = e.from; to.value = e.to;
          calc();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    };
    // Record a conversion once the user settles (not per keystroke); skip
    // repeats of the most recent entry. Only user actions record — mounting
    // the view must never write a phantom entry.
    let interacted = false;
    let histTimer = null;
    const scheduleRecord = () => {
      if (!interacted) return;
      if (histTimer) clearTimeout(histTimer);
      histTimer = setTimeout(() => {
        const a = num(amount.value);
        if (!Number.isFinite(a) || a <= 0) return;
        const out = convert(a, from.value, to.value, state.rates);
        if (!Number.isFinite(out)) return;
        const last = state.cvHistory[0];
        if (last && last.amount === a && last.from === from.value && last.to === to.value) return;
        state.cvHistory.unshift({ amount: a, from: from.value, to: to.value, result: formatMoney(out, to.value), ts: Date.now() });
        state.cvHistory = state.cvHistory.slice(0, 20);
        store.set('cvHistory', state.cvHistory);
        renderHist();
      }, 1200);
    };

    const calc = () => {
      $('cvFromName').textContent = CURRENCIES[from.value].name;
      $('cvToName').textContent = CURRENCIES[to.value].name;
      const out = convert(num(amount.value), from.value, to.value, state.rates);
      $('cvResult').textContent = Number.isFinite(out) ? formatMoney(out, to.value) : '—';
      const r = unitRate(from.value, to.value, state.rates);
      $('cvRate').textContent = `1 ${from.value} = ${r.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to.value}`;
      setShop(from.value); setHome(to.value);
      scheduleRecord();
    };
    const touch = () => { interacted = true; };
    amount.addEventListener('input', () => { touch(); calc(); });
    from.addEventListener('change', () => { touch(); calc(); });
    to.addEventListener('change', () => { touch(); calc(); });
    $('cvSwap').addEventListener('click', () => { touch(); const a = from.value; from.value = to.value; to.value = a; $('cvSwap').classList.toggle('spin'); calc(); });
    document.querySelectorAll('[data-amt]').forEach((c) => c.addEventListener('click', () => { touch(); amount.value = c.dataset.amt; calc(); }));
    $('cvHistClear').addEventListener('click', () => { state.cvHistory = []; store.set('cvHistory', []); renderHist(); });
    document.querySelectorAll('[data-rate-status]').forEach(refreshRateStatus);
    renderHist();
    calc();
  }
  return { html, mount };
}

function viewUnits() {
  const cats = Object.keys(UNIT_CATS);
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 14px">Units</h2>
    <div class="seg" id="unitCats" style="margin-bottom:14px">
      ${cats.map((c, i) => `<button data-cat="${c}" class="${i === 0 ? 'active' : ''}">${UNIT_CATS[c].icon} ${UNIT_CATS[c].name}</button>`).join('')}
    </div>
    <div class="glass" style="padding:16px">
      <div class="field" style="margin-bottom:10px">
        <label>From</label>
        <div style="display:flex;gap:12px;align-items:center;margin-top:6px">
          <input id="uVal" class="num-input" type="number" inputmode="decimal" step="any" value="1" />
          <select id="uFrom" class="sel" style="width:150px;flex:0 0 auto"></select>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin:-2px 0"><button id="uSwap" class="swap-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 4v13M7 4L3 8M7 4l4 4M17 20V7M17 20l4-4M17 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="field">
        <label>To</label>
        <div style="display:flex;gap:12px;align-items:center;margin-top:6px">
          <div style="flex:1;min-width:0"><div class="big-out" id="uOut">—</div></div>
          <select id="uTo" class="sel" style="width:150px;flex:0 0 auto"></select>
        </div>
      </div>
    </div>
  </div>`;
  function mount() {
    let cat = Object.keys(UNIT_CATS)[0];
    const val = $('uVal'), from = $('uFrom'), to = $('uTo');
    const fillUnits = () => {
      const units = Object.keys(UNIT_CATS[cat].units);
      const [df, dt] = UNIT_CATS[cat].defaults;
      from.innerHTML = units.map((u) => `<option ${u === df ? 'selected' : ''}>${u}</option>`).join('');
      to.innerHTML = units.map((u) => `<option ${u === dt ? 'selected' : ''}>${u}</option>`).join('');
    };
    const calc = () => { $('uOut').textContent = `${pretty(convertUnit(cat, num(val.value), from.value, to.value))} ${to.value}`; };
    document.querySelectorAll('#unitCats button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#unitCats button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active'); cat = b.dataset.cat; fillUnits(); calc();
    }));
    val.addEventListener('input', calc); from.addEventListener('change', calc); to.addEventListener('change', calc);
    $('uSwap').addEventListener('click', () => { const a = from.value; from.value = to.value; to.value = a; $('uSwap').classList.toggle('spin'); calc(); });
    fillUnits(); calc();
  }
  return { html, mount };
}

function viewSizes() {
  const keys = Object.keys(CHARTS);
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 14px">Sizes</h2>
    <div class="seg" id="szCharts" style="margin-bottom:14px">
      ${keys.map((k, i) => `<button data-k="${k}" class="${i === 0 ? 'active' : ''}">${CHARTS[k].icon} ${CHARTS[k].name}</button>`).join('')}
    </div>
    <div class="glass" style="padding:16px">
      <div style="display:flex;gap:12px;margin-bottom:14px">
        <div class="field" style="flex:1"><label>Your region</label><select id="szRegion" class="sel" style="margin-top:6px"></select></div>
        <div class="field" style="flex:1"><label>Your size</label><select id="szSize" class="sel" style="margin-top:6px"></select></div>
      </div>
      <div class="row-list" id="szOut"></div>
    </div>
    <p class="muted" style="font-size:12px;margin-top:10px;text-align:center">Sizes are indicative — brands and fits vary.</p>
  </div>`;
  function mount() {
    let k = keys[0];
    const region = $('szRegion'), size = $('szSize');
    const fillRegions = () => { region.innerHTML = CHARTS[k].regions.map((r, i) => `<option ${i === 0 ? 'selected' : ''}>${r}</option>`).join(''); };
    const fillSizes = () => { size.innerHTML = regionOptions(k, region.value).map((v) => `<option>${v}</option>`).join(''); };
    const calc = () => {
      const eq = equivalents(k, region.value, size.value);
      $('szOut').innerHTML = eq ? CHARTS[k].regions.map((r) =>
        `<div><span class="muted">${r}</span><strong style="font-size:18px">${eq[r]}</strong></div>`).join('')
        : `<div class="muted">Select a size</div>`;
    };
    document.querySelectorAll('#szCharts button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#szCharts button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active'); k = b.dataset.k; fillRegions(); fillSizes(); calc();
    }));
    region.addEventListener('change', () => { fillSizes(); calc(); });
    size.addEventListener('change', calc);
    fillRegions(); fillSizes(); calc();
  }
  return { html, mount };
}

function viewTips() {
  const countries = Object.keys(TIPPING);
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 14px">Tips &amp; split</h2>
    <div class="glass" style="padding:16px">
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div class="field" style="flex:1.3"><label>Bill amount</label>
          <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
            <input id="tpBill" class="num-input" style="font-size:24px" type="number" inputmode="decimal" step="any" value="50" />
            <select id="tpCur" class="sel" style="width:110px;flex:0 0 auto"></select>
          </div>
        </div>
      </div>
      <div class="field" style="margin-bottom:12px"><label>Country</label><select id="tpCountry" class="sel" style="margin-top:6px">
        ${(() => { const init = state.dest && TIPPING[state.dest] ? state.dest : 'US';
          return countries.map((c) => `<option value="${c}" ${c === init ? 'selected' : ''}>${TIPPING[c].name}</option>`).join(''); })()}</select></div>
      <div style="margin-bottom:12px"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.12em" class="muted">Tip</label>
        <div class="seg" id="tpPct" style="margin-top:6px"></div></div>
      <div class="field" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <label style="font-size:13px">Split between</label>
        <div style="display:flex;align-items:center;gap:14px">
          <button class="swap-btn" id="tpMinus" style="width:40px;height:40px">−</button>
          <strong id="tpPeople" style="font-size:20px;min-width:24px;text-align:center">1</strong>
          <button class="swap-btn" id="tpPlus" style="width:40px;height:40px">+</button>
        </div>
      </div>
      <div class="row-list">
        <div><span class="muted">Tip</span><strong id="tpTip" style="font-size:18px"></strong></div>
        <div><span class="muted">Total</span><strong id="tpTotal" style="font-size:20px"></strong></div>
        <div><span class="muted">Per person</span><strong id="tpPer" style="font-size:20px"></strong></div>
      </div>
      <p class="muted" id="tpNote" style="font-size:13px;margin:12px 0 0;line-height:1.5"></p>
      <p class="muted" id="tpHome" style="font-size:12px;margin:8px 0 0"></p>
    </div>
  </div>`;
  function mount() {
    let people = 1, pct = 18;
    const bill = $('tpBill'), cur = $('tpCur'), country = $('tpCountry');
    cur.innerHTML = currencyOptions(state.shop);
    const fillPct = () => {
      const t = TIPPING[country.value]; const opts = Array.from(new Set([...t.pct, 15, 20])).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
      pct = t.pct[1];
      $('tpPct').innerHTML = opts.map((p) => `<button data-p="${p}" class="${p === pct ? 'active' : ''}">${p}%</button>`).join('');
      document.querySelectorAll('#tpPct button').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('#tpPct button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active'); pct = num(b.dataset.p); calc();
      }));
    };
    const calc = () => {
      const r = calcTip(num(bill.value), pct, people);
      $('tpTip').textContent = formatMoney(r.tip, cur.value);
      $('tpTotal').textContent = formatMoney(r.total, cur.value);
      $('tpPer').textContent = formatMoney(r.perPerson, cur.value);
      $('tpNote').textContent = TIPPING[country.value].note;
      if (cur.value !== state.home) {
        const homeTotal = convert(r.total, cur.value, state.home, state.rates);
        $('tpHome').textContent = Number.isFinite(homeTotal) ? `≈ ${formatMoney(homeTotal, state.home)} total in your ${state.home}` : '';
      } else $('tpHome').textContent = '';
    };
    bill.addEventListener('input', calc); cur.addEventListener('change', () => { setShop(cur.value); calc(); });
    country.addEventListener('change', () => { fillPct(); calc(); });
    $('tpMinus').addEventListener('click', () => { people = Math.max(1, people - 1); $('tpPeople').textContent = people; calc(); });
    $('tpPlus').addEventListener('click', () => { people = Math.min(50, people + 1); $('tpPeople').textContent = people; calc(); });
    fillPct(); calc();
  }
  return { html, mount };
}

function viewPhrasebook() {
  const langs = Object.keys(LANGUAGES);
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 12px">Phrasebook</h2>
    <select id="phLang" class="sel" style="margin-bottom:12px">
      ${langs.map((l) => `<option value="${l}">${LANGUAGES[l].flag}  ${LANGUAGES[l].name}</option>`).join('')}</select>
    <div class="seg" id="phCat" style="margin-bottom:14px">
      ${PHRASE_CATS.map((c, i) => `<button data-c="${c}" class="${i === 0 ? 'active' : ''}">${c}</button>`).join('')}
    </div>
    <div id="phList" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>`;
  function mount() {
    // Open in the destination's language when we have a phrasebook for it.
    const destLang = state.dest && COUNTRIES[state.dest] && COUNTRIES[state.dest].lang;
    let lang = destLang && LANGUAGES[destLang] ? destLang : langs[0];
    let cat = PHRASE_CATS[0];
    $('phLang').value = lang;
    const canSpeak = 'speechSynthesis' in window;
    const render = () => {
      const items = PHRASES.filter((p) => p.cat === cat);
      $('phList').innerHTML = items.map((p, i) => {
        const [scriptText, pron] = p.t[lang];
        return `<div class="glass" style="padding:14px 16px;display:flex;align-items:center;gap:12px" data-i="${i}">
          <div style="flex:1;min-width:0">
            <div class="muted" style="font-size:12px">${esc(p.en)}</div>
            <div style="font-size:20px;font-weight:700;margin-top:2px">${esc(scriptText)}</div>
            <div class="muted" style="font-size:13px;opacity:.7">${esc(pron)}</div>
          </div>
          ${canSpeak ? `<button class="icon-btn" data-say="${esc(scriptText)}" aria-label="Speak">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 8a5 5 0 0 1 0 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </button>` : ''}
        </div>`;
      }).join('');
      if (canSpeak) document.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => {
        try { const u = new SpeechSynthesisUtterance(b.dataset.say); u.lang = LANGUAGES[lang].tts; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
      }));
    };
    $('phLang').addEventListener('change', (e) => { lang = e.target.value; render(); });
    document.querySelectorAll('#phCat button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#phCat button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active'); cat = b.dataset.c; render();
    }));
    render();
  }
  return { html, mount };
}

function viewEssentials() {
  const codes = Object.keys(COUNTRIES);
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 12px">Essentials</h2>
    <select id="esCountry" class="sel" style="margin-bottom:14px">
      ${codes.map((c) => `<option value="${c}">${COUNTRIES[c].flag}  ${COUNTRIES[c].name}</option>`).join('')}</select>
    <div id="esCard"></div>
  </div>`;
  function mount() {
    const sel = $('esCountry');
    const render = () => {
      const c = COUNTRIES[sel.value]; const w = WATER_LABEL[c.water];
      const em = c.emergency;
      const emRows = Object.entries(em).map(([k, v]) => {
        const label = { all: 'Emergency', police: 'Police', ambulance: 'Ambulance', fire: 'Fire', tourist: 'Tourist police', mobile: 'From mobile', alt: 'Also works' }[k] || k;
        return `<a href="tel:${v}" style="text-decoration:none;display:block"><div><span class="muted">${label}</span><strong style="font-size:18px;color:#fff">${v} ↗</strong></div></a>`;
      }).join('');
      const tip = TIPPING[sel.value];
      $('esCard').innerHTML = `
      <div class="glass" style="padding:16px;margin-bottom:12px">
        <div style="font-weight:700;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px" class="muted">🚨 Emergency numbers</div>
        <div class="row-list">${emRows}</div>
      </div>
      <div class="glass" style="padding:16px;margin-bottom:12px">
        <div class="row-list">
          <div><span class="muted">💧 Tap water</span><span class="chip pill-${w.tone}" style="cursor:default">${c.water}</span></div>
          <div><span class="muted">🔌 Plugs</span><strong>${c.plugs.map((p) => 'Type ' + p).join(', ')}</strong></div>
          <div><span class="muted">⚡ Power</span><strong>${c.voltage}V · ${c.freq}Hz</strong></div>
          <div><span class="muted">🚗 Driving</span><strong>${c.drive === 'left' ? 'Left side' : 'Right side'}</strong></div>
          <div><span class="muted">💰 Currency</span><strong>${c.currency} ${CURRENCIES[c.currency] ? CURRENCIES[c.currency].flag : ''}</strong></div>
          <div><span class="muted">📞 Dialing code</span><strong>${c.dial}</strong></div>
        </div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">${w.text}. ${c.plugs.map((p) => PLUG_INFO[p]).filter(Boolean)[0] || ''}</p>
      </div>
      <div class="glass" style="padding:16px;margin-bottom:12px">
        <div style="font-weight:700;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px" class="muted">🧾 Tipping</div>
        <p style="margin:0;font-size:14px;line-height:1.5">${tip ? esc(tip.note) : 'No specific guidance.'}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ghost" data-shop="${c.currency}">💱 Convert ${c.currency} → ${state.home}</button>
        <button class="btn-ghost" data-nav="#/lens" data-shop2="${c.currency}">🔍 Scan prices here</button>
      </div>`;
      $('esCard').querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => { setShop(b.dataset.shop); location.hash = '#/convert'; }));
      $('esCard').querySelectorAll('[data-shop2]').forEach((b) => b.addEventListener('click', () => { setShop(b.dataset.shop2); location.hash = '#/lens'; }));
    };
    sel.addEventListener('change', render);
    // Preselect the trip destination; fall back to a shop-currency match.
    if (state.dest && COUNTRIES[state.dest]) {
      sel.value = state.dest;
    } else {
      const match = codes.find((c) => COUNTRIES[c].currency === state.shop);
      if (match) sel.value = match;
    }
    render();
  }
  return { html, mount };
}

function viewWallet() {
  const html = `
  <div class="fade-up">
    <h2 style="font-weight:800;font-size:22px;margin:4px 2px 14px">Wallet</h2>
    <div class="glass" style="padding:16px;margin-bottom:14px;text-align:center">
      <div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.12em">Trip total</div>
      <div class="big-out" id="wlTotal" style="margin-top:4px">—</div>
      <div class="muted" id="wlTotalHome" style="font-size:13px;margin-top:2px"></div>
    </div>
    <div class="glass" style="padding:16px;margin-bottom:14px">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="wlAmt" class="num-input" style="font-size:22px" type="number" inputmode="decimal" step="any" placeholder="0" />
        <select id="wlCur" class="sel" style="width:104px;flex:0 0 auto"></select>
        <button class="btn-primary" id="wlAdd" style="flex:0 0 auto;padding:12px 16px">Add</button>
      </div>
      <input id="wlNote" class="text-input" style="font-size:15px;font-weight:500;margin-top:12px" placeholder="Note (e.g. lunch, taxi)…" />
    </div>
    <div id="wlList" style="display:flex;flex-direction:column;gap:8px"></div>
    <div style="text-align:center;margin-top:14px"><button class="chip" id="wlClear">Clear all</button></div>
  </div>`;
  function mount() {
    const amt = $('wlAmt'), cur = $('wlCur'), note = $('wlNote');
    cur.innerHTML = currencyOptions(state.shop);
    const render = () => {
      let totalHome = 0;
      $('wlList').innerHTML = state.wallet.length ? state.wallet.map((e, i) => {
        const h = convert(e.amount, e.cur, state.home, state.rates); totalHome += Number.isFinite(h) ? h : 0;
        return `<div class="glass" style="padding:12px 14px;display:flex;align-items:center;gap:10px">
          <div style="flex:1;min-width:0"><strong>${formatMoney(e.amount, e.cur)}</strong>
            <span class="muted" style="font-size:13px"> · ${esc(e.note || 'expense')}</span></div>
          <span class="muted" style="font-size:12px">${e.cur !== state.home && Number.isFinite(h) ? '≈ ' + formatMoney(h, state.home) : ''}</span>
          <button class="icon-btn" data-del="${i}" style="width:34px;height:34px" aria-label="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>`;
      }).join('') : `<p class="muted" style="text-align:center;font-size:13px">No expenses yet — add your first above.</p>`;
      $('wlTotal').textContent = state.wallet.length ? formatMoney(totalHome, state.home) : formatMoney(0, state.home);
      $('wlTotalHome').textContent = state.wallet.length ? `across ${state.wallet.length} expense${state.wallet.length > 1 ? 's' : ''}, in your ${state.home}` : 'add expenses in any currency';
      $('wlList').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
        state.wallet.splice(num(b.dataset.del), 1); store.set('wallet', state.wallet); render();
      }));
    };
    const add = () => {
      const a = num(amt.value); if (!Number.isFinite(a) || a <= 0) return;
      state.wallet.unshift({ amount: a, cur: cur.value, note: note.value.trim() });
      store.set('wallet', state.wallet); amt.value = ''; note.value = ''; setShop(cur.value); render();
    };
    $('wlAdd').addEventListener('click', add);
    amt.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    cur.addEventListener('change', () => setShop(cur.value));
    $('wlClear').addEventListener('click', () => { if (state.wallet.length && confirm('Clear all expenses?')) { state.wallet = []; store.set('wallet', []); render(); } });
    render();
  }
  return { html, mount };
}

/* ============================================================
   LENS controller (fullscreen, outside #view)
   ============================================================ */
const lensStage = $('lensStage');
let lens = null, lensPrevHash = '#/';
// Sale-rack mode: the % off the rack advertises. Applied at DISPLAY time to
// every scanned price (single or menu), so all the scanning intelligence —
// stitching, tap-to-focus, instant answers — works unchanged. In-memory
// only: a discount should not silently survive into tomorrow's shopping.
const SALE_OPTIONS = [0, 25, 30, 40, 50, 60, 70];
let lensSalePct = 0;
let lastLensResult = null;
const saleAdj = (v) => v * (1 - lensSalePct / 100);
function renderSaleChips() {
  $('lensSale').innerHTML = '<span class="sale-label">% off</span>' + SALE_OPTIONS.map((p) =>
    `<button class="sale-chip ${p === lensSalePct ? 'on' : ''}" data-sale="${p}">${p === 0 ? 'Off' : '−' + p + '%'}</button>`).join('');
}
function renderLensResult(r) {
  lastLensResult = r;
  const card = $('lensResult');
  card.style.display = 'block';
  card.style.opacity = '1';
  showLockBox(r.box); // green lock-on around the number being converted
  const pct = lensSalePct;
  if (r.multi) {
    // Several prices in view (a menu): list them converted, in the same
    // top-to-bottom order they appear on camera.
    $('lensConv').innerHTML = r.items.map((it) => `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:3px 0">
        <span style="font-size:15px;opacity:.65;font-weight:600">${it.fromText}</span>
        <span style="font-size:24px;font-weight:800">${formatMoney(saleAdj(it.converted), it.home)}</span>
      </div>`).join('');
    $('lensSrc').innerHTML = `${r.items.length} prices${pct ? ` · −${pct}%` : ''} · ${r.items[0].from} → ${r.items[0].home}`;
  } else {
    $('lensConv').textContent = formatMoney(saleAdj(r.converted), r.home);
    $('lensSrc').innerHTML = `${r.fromText} ${r.from} → ${r.home}` +
      (pct ? `<br><span class="sale-note">−${pct}% off applied · was ${r.homeText}</span>` : '');
  }
}
// With a trip destination set, the scanner converts ONLY that country's
// currency into yours (e.g. Canada → CAD to USD): the From picker is pinned.
function lensLockedCurrency() {
  return state.dest && COUNTRIES[state.dest] ? COUNTRIES[state.dest].currency : null;
}
function fillLensSelects() {
  const locked = lensLockedCurrency();
  $('lensShop').innerHTML = locked
    ? `<option value="${locked}" selected>${locked}</option>`
    : Object.keys(CURRENCIES).map((c) => `<option value="${c}" ${c === state.shop ? 'selected' : ''}>${c}</option>`).join('');
  $('lensShop').disabled = !!locked;
  $('lensHome').innerHTML = Object.keys(CURRENCIES).map((c) => `<option value="${c}" ${c === state.home ? 'selected' : ''}>${c}</option>`).join('');
  $('lensVer').textContent = 'Lens ' + LENS_VERSION;
}
function lensMsg(html) { const m = $('lensMsg'); m.style.display = html ? 'flex' : 'none'; m.innerHTML = html || ''; }

// The video fills the stage with object-fit: cover — these map between
// video pixel coordinates and on-screen stage coordinates.
function lensCoverGeom() {
  const v = $('lensVideo');
  const vw = v.videoWidth || 1280, vh = v.videoHeight || 720;
  const r = lensStage.getBoundingClientRect();
  const s = Math.max(r.width / vw, r.height / vh);
  return { s, dx: (r.width - vw * s) / 2, dy: (r.height - vh * s) / 2, rect: r };
}
function videoToScreen(x, y) {
  const g = lensCoverGeom();
  return { x: g.dx + x * g.s, y: g.dy + y * g.s };
}
function screenToVideo(x, y) {
  const g = lensCoverGeom();
  return { x: (x - g.dx) / g.s, y: (y - g.dy) / g.s };
}
// Position the green lock-on box over a video-space bbox.
function showLockBox(box) {
  const el = $('lensLock');
  if (!box) { el.classList.remove('on'); return; }
  const a = videoToScreen(box.x0, box.y0);
  const b = videoToScreen(box.x1, box.y1);
  const pad = 6;
  el.style.left = (Math.min(a.x, b.x) - pad) + 'px';
  el.style.top = (Math.min(a.y, b.y) - pad) + 'px';
  el.style.width = (Math.abs(b.x - a.x) + pad * 2) + 'px';
  el.style.height = (Math.abs(b.y - a.y) + pad * 2) + 'px';
  el.classList.remove('stale');
  el.classList.add('on');
}
function hideLockBox() { $('lensLock').classList.remove('on', 'stale'); }
function openLens() {
  lensStage.classList.add('on');
  document.body.style.overflow = 'hidden';
  fillLensSelects();
  renderSaleChips();
  $('lensResult').style.display = 'none';
  hideLockBox();
  lensMsg('');
  if (!isSecureCameraContext()) {
    lensMsg(`<div class="glass" style="padding:22px;max-width:340px"><div style="font-size:40px">📷</div>
      <h3 style="margin:8px 0 6px;font-size:19px">Camera needs HTTPS</h3>
      <p class="muted" style="font-size:14px">Open Roam over a secure connection to scan. You can still <a href="#/convert" id="lm1" style="text-decoration:underline">convert manually</a>.</p></div>`);
    return;
  }
  lens = lens || createLens({
    video: $('lensVideo'), ocrCanvas: $('lensOcr'),
    getShopCurrency: () => $('lensShop').value,
    getHomeCurrency: () => $('lensHome').value,
    getRates: () => state.rates,
    getCurrencyLock: () => !!lensLockedCurrency(),
    onStatus: (s) => { $('lensStatus').textContent = s.text || ''; },
    onError: (e) => {
      lensMsg(`<div class="glass" style="padding:22px;max-width:340px"><div style="font-size:40px">🚫</div>
        <h3 style="margin:8px 0 6px;font-size:19px">Can't scan</h3>
        <p class="muted" style="font-size:14px">${esc(e.message)}</p>
        <a href="#/convert" class="btn-ghost" style="margin-top:14px">Convert manually instead</a></div>`);
    },
    onResult: renderLensResult,
    // The camera moved on but OCR hasn't matched anything new — dim the old
    // number so it reads as "last seen", not "current".
    onStale: () => {
      $('lensResult').style.opacity = '0.45';
      $('lensLock').classList.add('stale');
    },
  });
  startLensSession();
}
// Tap-to-target: tap a number on screen and the scanner hones in on it,
// like tap-to-focus in the camera app.
lensStage.addEventListener('pointerdown', (e) => {
  if (!lens || !lens.isRunning()) return;
  // Ignore taps on controls, pickers, the result card, and overlays.
  if (e.target.closest('button, select, label, .lens-result, .lens-top, .lens-bottom, .lens-sale, .lens-overlay-msg')) return;
  const rect = lensStage.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  // Camera-style focus ping where the finger landed.
  const ping = $('lensFocus');
  ping.style.left = sx + 'px';
  ping.style.top = sy + 'px';
  ping.classList.remove('ping');
  void ping.offsetWidth; // restart the animation
  ping.classList.add('ping');
  const v = screenToVideo(sx, sy);
  lens.setTarget(v.x, v.y);
  $('lensStatus').textContent = 'Focusing…';
});
function startLensSession() {
  lens.start().then((okStarted) => {
    if (!okStarted) return;
    const tb = $('lensTorch');
    if (lens.torchCapable()) {
      tb.style.display = 'grid'; tb.style.opacity = '.6';
      tb.onclick = async () => { const on = await lens.toggleTorch(); tb.style.opacity = on ? '1' : '.6'; };
    } else {
      tb.style.display = 'none';
    }
  });
  // Full restart escape hatch — fresh camera, fresh OCR worker, clean state.
  $('lensReset').onclick = async () => {
    const btn = $('lensReset');
    if (btn.disabled) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '.6';
    btn.innerHTML = '⏳ Restarting…';
    $('lensStatus').textContent = 'Restarting…';
    $('lensResult').style.display = 'none';
    hideLockBox();
    lensMsg('');
    try { await lens.reset(); }
    finally {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = original;
    }
    const tb = $('lensTorch');
    if (lens.torchCapable()) { tb.style.display = 'grid'; tb.style.opacity = '.6'; }
    else tb.style.display = 'none';
  };
}
// iOS pauses camera streams when the app is backgrounded and won't always
// resume them — release on hide, reacquire on return.
document.addEventListener('visibilitychange', () => {
  if (!lens || !lensStage.classList.contains('on')) return;
  if (document.hidden) lens.stop();
  else startLensSession();
});
function closeLens(navigateBack = true) {
  lensStage.classList.remove('on');
  document.body.style.overflow = '';
  if (lens) lens.stop();
  if (navigateBack && location.hash === '#/lens') location.hash = (lensPrevHash && lensPrevHash !== '#/lens') ? lensPrevHash : '#/';
}
$('lensClose').addEventListener('click', () => closeLens(true));
$('lensShop').addEventListener('change', (e) => setShop(e.target.value));
$('lensSale').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-sale]');
  if (!chip) return;
  lensSalePct = Number(chip.dataset.sale) || 0;
  renderSaleChips();
  // Retune the reading on screen immediately — no need to re-scan the tag.
  if (lastLensResult) renderLensResult(lastLensResult);
});
$('lensHome').addEventListener('change', (e) => setHome(e.target.value));

/* ============================================================
   App menu (right-hand sheet)
   ============================================================ */
const menuSheet = $('menuSheet');
function openMenu() {
  // Populate fresh each open so selections always mirror current state.
  $('menuHome').innerHTML = currencyOptions(state.home);
  $('menuDest').innerHTML = destOptions(state.dest || '');
  menuSheet.classList.add('on');
  menuSheet.setAttribute('aria-hidden', 'false');
  $('menuBtn').setAttribute('aria-expanded', 'true');
  document.querySelectorAll('[data-rate-status]').forEach(refreshRateStatus);
}
function closeMenu() {
  menuSheet.classList.remove('on');
  menuSheet.setAttribute('aria-hidden', 'true');
  $('menuBtn').setAttribute('aria-expanded', 'false');
}
$('menuBtn').addEventListener('click', () => {
  menuSheet.classList.contains('on') ? closeMenu() : openMenu();
});
$('menuClose').addEventListener('click', closeMenu);
$('menuBackdrop').addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuSheet.classList.contains('on')) closeMenu();
});
$('menuHome').addEventListener('change', (e) => { setHome(e.target.value); renderRoute(); });
$('menuDest').addEventListener('change', (e) => {
  setDest(e.target.value);
  closeMenu();
  // Land on home so the whole app visibly shifts to the new destination.
  if (location.hash === '#/' || location.hash === '') renderRoute();
  else location.hash = '#/';
});
$('menuRefresh').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = 'Refreshing…';
  await loadRates();
  btn.disabled = false; btn.textContent = 'Refresh';
  renderRoute();
});

/* ============================================================
   Router
   ============================================================ */
const ROUTES = {
  '': { title: 'Roam', view: viewHome, home: true },
  '#/': { title: 'Roam', view: viewHome, home: true },
  '#/convert': { title: 'Convert', view: viewConvert },
  '#/units': { title: 'Units', view: viewUnits },
  '#/sizes': { title: 'Sizes', view: viewSizes },
  '#/tips': { title: 'Tips & split', view: viewTips },
  '#/phrasebook': { title: 'Phrasebook', view: viewPhrasebook },
  '#/essentials': { title: 'Essentials', view: viewEssentials },
  '#/wallet': { title: 'Wallet', view: viewWallet },
};
let activeKey = null;
function rerenderIfActive(key) { if (activeKey === key) renderRoute(); }
function renderRoute() {
  const hash = location.hash || '#/';
  if (hash === '#/lens') { openLens(); return; }
  if (lensStage.classList.contains('on')) closeLens(false);
  const r = ROUTES[hash] || ROUTES['#/'];
  activeKey = (r.view.name || '').replace('view', '').toLowerCase();
  const built = r.view();
  view.innerHTML = built.html;
  if (built.mount) built.mount();
  $('appTitle').textContent = r.title;
  $('backBtn').style.display = r.home ? 'none' : 'grid';
  window.scrollTo(0, 0);
  document.querySelectorAll('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.nav === hash || (r.home && t.dataset.nav === '#/')));
  if (hash !== '#/lens') lensPrevHash = hash;
}
window.addEventListener('hashchange', renderRoute);

// Global navigation via [data-nav]
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    const shop2 = nav.getAttribute('data-shop2'); if (shop2) setShop(shop2);
    if (menuSheet.classList.contains('on')) closeMenu();
    const target = nav.dataset.nav;
    // Re-render even when the hash is unchanged (e.g. menu → current view).
    if (location.hash === target) renderRoute(); else location.hash = target;
  }
});
$('backBtn').addEventListener('click', () => { location.hash = '#/'; });
$('brand').addEventListener('click', () => { location.hash = '#/'; });
document.querySelectorAll('#tabbar .tab').forEach((t) => t.addEventListener('click', () => { location.hash = t.dataset.nav; }));

/* ============================================================
   Boot
   ============================================================ */
renderRoute();
loadRates();

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e; showInstall();
  $('menuInstallWrap').style.display = 'block';
});
$('menuInstall').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('menuInstallWrap').style.display = 'none';
  closeMenu();
});
function showInstall() {
  if (!deferredPrompt || document.getElementById('installBtn')) return;
  const b = document.createElement('button');
  b.id = 'installBtn'; b.className = 'btn-primary'; b.textContent = '⤓ Install Roam';
  b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + var(--safe-bottom));z-index:50;font-size:13px;padding:10px 18px';
  b.onclick = async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; b.remove(); };
  document.body.appendChild(b);
  setTimeout(() => { if (document.getElementById('installBtn')) b.remove(); }, 12000);
}
window.addEventListener('appinstalled', () => {
  const b = document.getElementById('installBtn'); if (b) b.remove();
  $('menuInstallWrap').style.display = 'none';
});

// Expose a few internals for automated tests.
window.__roam = { state, convert, parseLensText: null };
