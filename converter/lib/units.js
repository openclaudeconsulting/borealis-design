/* ============================================================
   units — everyday unit conversions travellers actually need.
   Linear categories use a factor to a base unit; temperature and
   fuel economy use explicit formulas.
   ============================================================ */

export const CATEGORIES = {
  length: {
    name: 'Length', icon: '📏',
    units: {
      'km': 1000, 'm': 1, 'cm': 0.01, 'mm': 0.001,
      'mi': 1609.344, 'yd': 0.9144, 'ft': 0.3048, 'in': 0.0254,
    },
    defaults: ['mi', 'km'],
  },
  mass: {
    name: 'Weight', icon: '⚖️',
    units: { 'kg': 1, 'g': 0.001, 'lb': 0.45359237, 'oz': 0.0283495231, 'st': 6.35029318 },
    defaults: ['lb', 'kg'],
  },
  volume: {
    name: 'Volume', icon: '🧴',
    units: {
      'L': 1, 'mL': 0.001,
      'US gal': 3.785411784, 'UK gal': 4.54609,
      'US cup': 0.2365882365, 'fl oz': 0.0295735296,
    },
    defaults: ['US gal', 'L'],
  },
  speed: {
    name: 'Speed', icon: '🚗',
    units: { 'km/h': 1, 'mph': 1.609344, 'm/s': 3.6, 'knot': 1.852 },
    defaults: ['mph', 'km/h'],
  },
  area: {
    name: 'Area', icon: '🗺️',
    units: { 'm²': 1, 'ft²': 0.09290304, 'km²': 1e6, 'mi²': 2589988.110336, 'acre': 4046.8564224, 'ha': 10000 },
    defaults: ['ft²', 'm²'],
  },
  temperature: {
    name: 'Temperature', icon: '🌡️',
    units: { '°C': null, '°F': null, 'K': null },
    defaults: ['°F', '°C'],
    special: 'temperature',
  },
  fuel: {
    name: 'Fuel economy', icon: '⛽',
    units: { 'mpg (US)': null, 'mpg (UK)': null, 'L/100km': null, 'km/L': null },
    defaults: ['mpg (US)', 'L/100km'],
    special: 'fuel',
  },
};

function convertTemperature(value, from, to) {
  let c; // to Celsius
  if (from === '°C') c = value;
  else if (from === '°F') c = (value - 32) * 5 / 9;
  else if (from === 'K') c = value - 273.15;
  else return NaN;
  if (to === '°C') return c;
  if (to === '°F') return c * 9 / 5 + 32;
  if (to === 'K') return c + 273.15;
  return NaN;
}

// Convert everything through L/100km (consumption). mpg/km-L are efficiency, so
// they invert. 235.214583 = litres·miles per 100km·gallon(US) constant.
function toL100(value, unit) {
  if (value <= 0) return NaN;
  switch (unit) {
    case 'L/100km': return value;
    case 'mpg (US)': return 235.214583 / value;
    case 'mpg (UK)': return 282.480936 / value;
    case 'km/L': return 100 / value;
    default: return NaN;
  }
}
function fromL100(l100, unit) {
  if (l100 <= 0) return NaN;
  switch (unit) {
    case 'L/100km': return l100;
    case 'mpg (US)': return 235.214583 / l100;
    case 'mpg (UK)': return 282.480936 / l100;
    case 'km/L': return 100 / l100;
    default: return NaN;
  }
}

export function convertUnit(catKey, value, from, to) {
  const cat = CATEGORIES[catKey];
  if (!cat || !Number.isFinite(value)) return NaN;
  if (cat.special === 'temperature') return convertTemperature(value, from, to);
  if (cat.special === 'fuel') return fromL100(toL100(value, from), to);
  const f = cat.units[from], t = cat.units[to];
  if (!f || !t) return NaN;
  return (value * f) / t;
}

/** Trim to a sensible number of significant places for display. */
export function pretty(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  let s;
  if (abs !== 0 && abs < 0.01) s = n.toPrecision(3);
  else if (abs < 100) s = n.toFixed(2);
  else if (abs < 10000) s = n.toFixed(1);
  else s = Math.round(n).toString();
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
