/* ============================================================
   tips — tipping etiquette by country + a bill/split calculator.
   Guidance is practical and indicative; customs vary by venue.
   ============================================================ */

// pct: [low, typical, high] suggested %. expected: is a tip expected at all.
export const TIPPING = {
  US: { name: 'United States',  pct: [15, 18, 20], expected: true,  note: 'Expected. 18–20% at sit-down restaurants; tip bars, taxis and hotel staff too.' },
  CA: { name: 'Canada',         pct: [15, 18, 20], expected: true,  note: 'Expected. 15–20% at restaurants, similar to the US.' },
  GB: { name: 'United Kingdom', pct: [10, 12, 15], expected: true,  note: 'Check for a “service charge” on the bill first — if present, no extra needed. Otherwise ~10–12.5%.' },
  IE: { name: 'Ireland',        pct: [10, 12, 15], expected: true,  note: '10–15% if service isn’t already added.' },
  FR: { name: 'France',         pct: [0, 5, 10],   expected: false, note: 'Service is included by law (“service compris”). Round up or leave a few euros for good service.' },
  DE: { name: 'Germany',        pct: [5, 8, 10],   expected: true,  note: 'Round up or add ~5–10%. Tell the server the total when paying.' },
  IT: { name: 'Italy',          pct: [0, 5, 10],   expected: false, note: 'A “coperto” cover charge is common. Rounding up is plenty; 5–10% is generous.' },
  ES: { name: 'Spain',          pct: [0, 5, 10],   expected: false, note: 'Not expected. Round up or leave small change; 5–10% for great service.' },
  PT: { name: 'Portugal',       pct: [0, 5, 10],   expected: false, note: 'Round up or leave 5–10% for good service.' },
  NL: { name: 'Netherlands',    pct: [5, 8, 10],   expected: false, note: 'Round up or add ~5–10%; service is included.' },
  CH: { name: 'Switzerland',    pct: [0, 5, 10],   expected: false, note: 'Service is included. Round up to the nearest franc or two.' },
  AT: { name: 'Austria',        pct: [5, 8, 10],   expected: true,  note: 'Round up or add ~5–10%, handed directly to the server.' },
  BE: { name: 'Belgium',        pct: [0, 5, 10],   expected: false, note: 'Included; round up for good service.' },
  SE: { name: 'Sweden',         pct: [0, 5, 10],   expected: false, note: 'Included. Round up or ~10% for great service.' },
  NO: { name: 'Norway',         pct: [0, 5, 10],   expected: false, note: 'Included. Round up or ~10% for great service.' },
  DK: { name: 'Denmark',        pct: [0, 5, 10],   expected: false, note: 'Included by law. Round up if you like.' },
  GR: { name: 'Greece',         pct: [5, 8, 10],   expected: false, note: 'Round up or leave 5–10%.' },
  JP: { name: 'Japan',          pct: [0, 0, 0],    expected: false, note: 'Do NOT tip — it can cause confusion or be seen as rude. Excellent service is standard.' },
  CN: { name: 'China',          pct: [0, 0, 0],    expected: false, note: 'Not customary (though appearing in some tourist spots and for tour guides).' },
  KR: { name: 'South Korea',    pct: [0, 0, 0],    expected: false, note: 'Not expected and not part of the culture.' },
  SG: { name: 'Singapore',      pct: [0, 0, 0],    expected: false, note: 'Not expected; a 10% service charge is usually already added.' },
  TH: { name: 'Thailand',       pct: [0, 5, 10],   expected: false, note: 'Not obligatory. Round up; ~10% at nicer restaurants.' },
  VN: { name: 'Vietnam',        pct: [0, 5, 10],   expected: false, note: 'Not customary but appreciated; round up or leave small change.' },
  ID: { name: 'Indonesia',      pct: [5, 8, 10],   expected: false, note: 'Round up; a service charge is often included at hotels/restaurants.' },
  IN: { name: 'India',          pct: [5, 8, 10],   expected: true,  note: '5–10% at restaurants if service isn’t included. Small tips appreciated widely.' },
  AE: { name: 'UAE',            pct: [10, 12, 15], expected: true,  note: '10–15%; a service charge may already be added — check the bill.' },
  AU: { name: 'Australia',      pct: [0, 5, 10],   expected: false, note: 'Not expected; staff are paid a living wage. ~10% for exceptional service.' },
  NZ: { name: 'New Zealand',    pct: [0, 5, 10],   expected: false, note: 'Not expected. Tip only for something special.' },
  MX: { name: 'Mexico',         pct: [10, 12, 15], expected: true,  note: 'Expected. 10–15% (“propina”) at restaurants.' },
  BR: { name: 'Brazil',         pct: [10, 10, 10], expected: true,  note: 'A 10% service charge (“serviço”) is usually added — that is the tip.' },
  AR: { name: 'Argentina',      pct: [10, 10, 10], expected: true,  note: '~10% in cash, as it may not reach staff via card.' },
  TR: { name: 'Turkey',         pct: [5, 8, 10],   expected: true,  note: '5–10% at restaurants; leave cash.' },
  EG: { name: 'Egypt',          pct: [5, 10, 10],  expected: true,  note: '“Baksheesh” is customary — 5–10% plus small tips for many services.' },
  MA: { name: 'Morocco',        pct: [5, 8, 10],   expected: true,  note: '5–10% at restaurants; small tips for guides and helpers.' },
  ZA: { name: 'South Africa',   pct: [10, 12, 15], expected: true,  note: 'Expected. 10–15% at restaurants; tip petrol attendants and car guards.' },
};

/**
 * @param {number} bill  pre-tip bill amount
 * @param {number} pct   tip percentage
 * @param {number} people split between N people (>=1)
 * @returns {{tip,total,perPerson,perPersonTip}}
 */
export function calcTip(bill, pct, people = 1) {
  const b = Number.isFinite(bill) && bill > 0 ? bill : 0;
  const p = Number.isFinite(pct) && pct >= 0 ? pct : 0;
  const n = Number.isFinite(people) && people >= 1 ? Math.floor(people) : 1;
  const tip = b * (p / 100);
  const total = b + tip;
  return { tip, total, perPerson: total / n, perPersonTip: tip / n };
}
