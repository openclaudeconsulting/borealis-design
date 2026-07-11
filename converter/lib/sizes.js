/* ============================================================
   sizes — clothing & shoe size conversion for shopping abroad.
   Each chart is a set of regions with equal-length rows; a row is
   one set of equivalent sizes. Values are indicative (brands vary).
   ============================================================ */

export const CHARTS = {
  womensShoes: {
    name: "Women's shoes", icon: '👠',
    regions: ['US', 'UK', 'EU', 'CM'],
    rows: [
      ['5',   '2.5', '35',   '21.5'],
      ['5.5', '3',   '35.5', '22'],
      ['6',   '3.5', '36',   '22.5'],
      ['6.5', '4',   '37',   '23'],
      ['7',   '4.5', '37.5', '23.5'],
      ['7.5', '5',   '38',   '24'],
      ['8',   '5.5', '38.5', '24.5'],
      ['8.5', '6',   '39',   '25'],
      ['9',   '6.5', '40',   '25.5'],
      ['9.5', '7',   '40.5', '26'],
      ['10',  '7.5', '41',   '26.5'],
      ['10.5','8',   '42',   '27'],
      ['11',  '8.5', '42.5', '27.5'],
    ],
  },
  mensShoes: {
    name: "Men's shoes", icon: '👞',
    regions: ['US', 'UK', 'EU', 'CM'],
    rows: [
      ['7',   '6',   '40',   '25'],
      ['7.5', '6.5', '40.5', '25.5'],
      ['8',   '7',   '41',   '26'],
      ['8.5', '7.5', '42',   '26.5'],
      ['9',   '8',   '42.5', '27'],
      ['9.5', '8.5', '43',   '27.5'],
      ['10',  '9',   '44',   '28'],
      ['10.5','9.5', '44.5', '28.5'],
      ['11',  '10',  '45',   '29'],
      ['11.5','10.5','45.5', '29.5'],
      ['12',  '11',  '46',   '30'],
      ['13',  '12',  '47',   '31'],
      ['14',  '13',  '48',   '32'],
    ],
  },
  womensClothing: {
    name: "Women's clothing", icon: '👗',
    regions: ['US', 'UK', 'EU', 'IT', 'Intl'],
    rows: [
      ['0',  '4',  '32', '36', 'XXS'],
      ['2',  '6',  '34', '38', 'XS'],
      ['4',  '8',  '36', '40', 'S'],
      ['6',  '10', '38', '42', 'S'],
      ['8',  '12', '40', '44', 'M'],
      ['10', '14', '42', '46', 'M'],
      ['12', '16', '44', '48', 'L'],
      ['14', '18', '46', '50', 'L'],
      ['16', '20', '48', '52', 'XL'],
      ['18', '22', '50', '54', 'XXL'],
    ],
  },
  mensClothing: {
    name: "Men's tops", icon: '👔',
    regions: ['Intl', 'US/UK (chest)', 'EU'],
    rows: [
      ['XS',  '34', '44'],
      ['S',   '36', '46'],
      ['M',   '38', '48'],
      ['L',   '40', '50'],
      ['XL',  '42', '52'],
      ['XXL', '44', '54'],
      ['3XL', '46', '56'],
    ],
  },
};

function norm(v) {
  const s = String(v).trim().toUpperCase();
  const n = parseFloat(s);
  return Number.isFinite(n) && String(n) === s.replace(/^0+(?=\d)/, '') ? n : s;
}

/**
 * Given a chart, the region you know and a value, return the equivalent row
 * as { region: value }. Matches numerically when possible, else by label.
 * Returns null if the size isn't in the chart.
 */
export function equivalents(chartKey, region, value) {
  const chart = CHARTS[chartKey];
  if (!chart) return null;
  const col = chart.regions.indexOf(region);
  if (col < 0) return null;
  const target = norm(value);
  let row = chart.rows.find((r) => norm(r[col]) === target);
  // For letter sizes (S/M/L) multiple rows can match a region value; first wins.
  if (!row) return null;
  const out = {};
  chart.regions.forEach((r, i) => { out[r] = row[i]; });
  return out;
}

export function regionOptions(chartKey, region) {
  const chart = CHARTS[chartKey];
  if (!chart) return [];
  const col = chart.regions.indexOf(region);
  if (col < 0) return [];
  // De-duplicate while preserving order (letter charts repeat S, M, L…).
  const seen = new Set();
  return chart.rows.map((r) => r[col]).filter((v) => (seen.has(v) ? false : seen.add(v)));
}
