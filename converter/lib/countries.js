/* ============================================================
   countries — offline "essentials" card per destination:
   emergency numbers, power plugs/voltage, tap-water safety,
   driving side, currency and dialing code.
   Reference data — verify locally for anything safety-critical.
   ============================================================ */

// emergency: use {all} where one number covers everything, else split.
// water: 'safe' | 'caution' | 'unsafe'. drive: 'left' | 'right'.
export const COUNTRIES = {
  US: { name: 'United States', flag: '🇺🇸', currency: 'USD', dial: '+1',   emergency: { all: '911' }, plugs: ['A','B'], voltage: 120, freq: 60, water: 'safe', drive: 'right' },
  CA: { name: 'Canada',        flag: '🇨🇦', currency: 'CAD', dial: '+1',   emergency: { all: '911' }, plugs: ['A','B'], voltage: 120, freq: 60, water: 'safe', drive: 'right' },
  MX: { name: 'Mexico',        flag: '🇲🇽', currency: 'MXN', dial: '+52',  emergency: { all: '911' }, plugs: ['A','B'], voltage: 127, freq: 60, water: 'unsafe', drive: 'right' },
  GB: { name: 'United Kingdom',flag: '🇬🇧', currency: 'GBP', dial: '+44',  emergency: { all: '999', alt: '112' }, plugs: ['G'], voltage: 230, freq: 50, water: 'safe', drive: 'left' },
  IE: { name: 'Ireland',       flag: '🇮🇪', currency: 'EUR', dial: '+353', emergency: { all: '112', alt: '999' }, plugs: ['G'], voltage: 230, freq: 50, water: 'safe', drive: 'left' },
  FR: { name: 'France',        flag: '🇫🇷', currency: 'EUR', dial: '+33',  emergency: { all: '112' }, plugs: ['C','E'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  ES: { name: 'Spain',         flag: '🇪🇸', currency: 'EUR', dial: '+34',  emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  PT: { name: 'Portugal',      flag: '🇵🇹', currency: 'EUR', dial: '+351', emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  DE: { name: 'Germany',       flag: '🇩🇪', currency: 'EUR', dial: '+49',  emergency: { all: '112', police: '110' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  IT: { name: 'Italy',         flag: '🇮🇹', currency: 'EUR', dial: '+39',  emergency: { all: '112' }, plugs: ['C','F','L'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  NL: { name: 'Netherlands',   flag: '🇳🇱', currency: 'EUR', dial: '+31',  emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  CH: { name: 'Switzerland',   flag: '🇨🇭', currency: 'CHF', dial: '+41',  emergency: { all: '112', police: '117', ambulance: '144' }, plugs: ['C','J'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  AT: { name: 'Austria',       flag: '🇦🇹', currency: 'EUR', dial: '+43',  emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  BE: { name: 'Belgium',       flag: '🇧🇪', currency: 'EUR', dial: '+32',  emergency: { all: '112' }, plugs: ['C','E'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  GR: { name: 'Greece',        flag: '🇬🇷', currency: 'EUR', dial: '+30',  emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  CZ: { name: 'Czechia',       flag: '🇨🇿', currency: 'CZK', dial: '+420', emergency: { all: '112' }, plugs: ['C','E'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  PL: { name: 'Poland',        flag: '🇵🇱', currency: 'PLN', dial: '+48',  emergency: { all: '112' }, plugs: ['C','E'], voltage: 230, freq: 50, water: 'caution', drive: 'right' },
  SE: { name: 'Sweden',        flag: '🇸🇪', currency: 'SEK', dial: '+46',  emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  NO: { name: 'Norway',        flag: '🇳🇴', currency: 'NOK', dial: '+47',  emergency: { all: '112', police: '112', ambulance: '113' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  DK: { name: 'Denmark',       flag: '🇩🇰', currency: 'DKK', dial: '+45',  emergency: { all: '112' }, plugs: ['C','E','F','K'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  IS: { name: 'Iceland',       flag: '🇮🇸', currency: 'ISK', dial: '+354', emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  TR: { name: 'Turkey',        flag: '🇹🇷', currency: 'TRY', dial: '+90',  emergency: { all: '112' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'caution', drive: 'right' },
  JP: { name: 'Japan',         flag: '🇯🇵', currency: 'JPY', dial: '+81',  emergency: { police: '110', ambulance: '119', fire: '119' }, plugs: ['A','B'], voltage: 100, freq: 50, water: 'safe', drive: 'left' },
  KR: { name: 'South Korea',   flag: '🇰🇷', currency: 'KRW', dial: '+82',  emergency: { police: '112', ambulance: '119', fire: '119' }, plugs: ['C','F'], voltage: 220, freq: 60, water: 'caution', drive: 'right' },
  CN: { name: 'China',         flag: '🇨🇳', currency: 'CNY', dial: '+86',  emergency: { police: '110', ambulance: '120', fire: '119' }, plugs: ['A','C','I'], voltage: 220, freq: 50, water: 'unsafe', drive: 'right' },
  HK: { name: 'Hong Kong',     flag: '🇭🇰', currency: 'HKD', dial: '+852', emergency: { all: '999', alt: '112' }, plugs: ['G'], voltage: 220, freq: 50, water: 'safe', drive: 'left' },
  TW: { name: 'Taiwan',        flag: '🇹🇼', currency: 'TWD', dial: '+886', emergency: { police: '110', ambulance: '119', fire: '119' }, plugs: ['A','B'], voltage: 110, freq: 60, water: 'caution', drive: 'right' },
  TH: { name: 'Thailand',      flag: '🇹🇭', currency: 'THB', dial: '+66',  emergency: { police: '191', ambulance: '1669', tourist: '1155' }, plugs: ['A','B','C','O'], voltage: 230, freq: 50, water: 'unsafe', drive: 'left' },
  VN: { name: 'Vietnam',       flag: '🇻🇳', currency: 'VND', dial: '+84',  emergency: { police: '113', ambulance: '115', fire: '114' }, plugs: ['A','C','F'], voltage: 220, freq: 50, water: 'unsafe', drive: 'right' },
  ID: { name: 'Indonesia',     flag: '🇮🇩', currency: 'IDR', dial: '+62',  emergency: { all: '112', police: '110', ambulance: '118' }, plugs: ['C','F'], voltage: 230, freq: 50, water: 'unsafe', drive: 'left' },
  MY: { name: 'Malaysia',      flag: '🇲🇾', currency: 'MYR', dial: '+60',  emergency: { all: '999', alt: '112' }, plugs: ['G'], voltage: 240, freq: 50, water: 'caution', drive: 'left' },
  SG: { name: 'Singapore',     flag: '🇸🇬', currency: 'SGD', dial: '+65',  emergency: { police: '999', ambulance: '995', fire: '995' }, plugs: ['G'], voltage: 230, freq: 50, water: 'safe', drive: 'left' },
  IN: { name: 'India',         flag: '🇮🇳', currency: 'INR', dial: '+91',  emergency: { all: '112', police: '100', ambulance: '102' }, plugs: ['C','D','M'], voltage: 230, freq: 50, water: 'unsafe', drive: 'left' },
  AE: { name: 'UAE',           flag: '🇦🇪', currency: 'AED', dial: '+971', emergency: { police: '999', ambulance: '998', fire: '997' }, plugs: ['G'], voltage: 230, freq: 50, water: 'caution', drive: 'right' },
  SA: { name: 'Saudi Arabia',  flag: '🇸🇦', currency: 'SAR', dial: '+966', emergency: { police: '999', ambulance: '997', fire: '998' }, plugs: ['G'], voltage: 230, freq: 60, water: 'caution', drive: 'right' },
  IL: { name: 'Israel',        flag: '🇮🇱', currency: 'ILS', dial: '+972', emergency: { police: '100', ambulance: '101', fire: '102' }, plugs: ['C','H','M'], voltage: 230, freq: 50, water: 'safe', drive: 'right' },
  EG: { name: 'Egypt',         flag: '🇪🇬', currency: 'EGP', dial: '+20',  emergency: { police: '122', ambulance: '123', tourist: '126' }, plugs: ['C','F'], voltage: 220, freq: 50, water: 'unsafe', drive: 'right' },
  MA: { name: 'Morocco',       flag: '🇲🇦', currency: 'MAD', dial: '+212', emergency: { police: '19', ambulance: '15' }, plugs: ['C','E'], voltage: 220, freq: 50, water: 'unsafe', drive: 'right' },
  ZA: { name: 'South Africa',  flag: '🇿🇦', currency: 'ZAR', dial: '+27',  emergency: { police: '10111', ambulance: '10177', mobile: '112' }, plugs: ['C','D','M','N'], voltage: 230, freq: 50, water: 'caution', drive: 'left' },
  AU: { name: 'Australia',     flag: '🇦🇺', currency: 'AUD', dial: '+61',  emergency: { all: '000', mobile: '112' }, plugs: ['I'], voltage: 230, freq: 50, water: 'safe', drive: 'left' },
  NZ: { name: 'New Zealand',   flag: '🇳🇿', currency: 'NZD', dial: '+64',  emergency: { all: '111' }, plugs: ['I'], voltage: 230, freq: 50, water: 'safe', drive: 'left' },
  BR: { name: 'Brazil',        flag: '🇧🇷', currency: 'BRL', dial: '+55',  emergency: { police: '190', ambulance: '192', fire: '193' }, plugs: ['C','N'], voltage: 127, freq: 60, water: 'unsafe', drive: 'right' },
  AR: { name: 'Argentina',     flag: '🇦🇷', currency: 'ARS', dial: '+54',  emergency: { all: '911', police: '101', ambulance: '107' }, plugs: ['C','I'], voltage: 220, freq: 50, water: 'caution', drive: 'right' },
  PE: { name: 'Peru',          flag: '🇵🇪', currency: 'PEN', dial: '+51',  emergency: { all: '105', ambulance: '116' }, plugs: ['A','B','C'], voltage: 220, freq: 60, water: 'unsafe', drive: 'right' },
};

export const WATER_LABEL = {
  safe:    { text: 'Tap water generally safe to drink', tone: 'good' },
  caution: { text: 'Tap water — locals often drink it, but visitors may prefer bottled/filtered', tone: 'warn' },
  unsafe:  { text: 'Stick to bottled or purified water', tone: 'bad' },
};

export const PLUG_INFO = {
  A: 'Type A — 2 flat pins (North America, Japan)',
  B: 'Type B — 2 flat + ground (North America)',
  C: 'Type C — 2 round pins (Europe standard “Europlug”)',
  D: 'Type D — 3 round pins (India)',
  E: 'Type E — 2 round + ground pin (France, Belgium)',
  F: 'Type F — 2 round + side clips (“Schuko”, Europe)',
  G: 'Type G — 3 rectangular pins (UK, Ireland, Singapore)',
  H: 'Type H — 3 pins (Israel)',
  I: 'Type I — angled pins (Australia, China, Argentina)',
  J: 'Type J — 3 round pins (Switzerland)',
  K: 'Type K — 3 round pins (Denmark)',
  L: 'Type L — 3 round pins in a row (Italy)',
  M: 'Type M — 3 large round pins (South Africa)',
  N: 'Type N — 3 round pins (Brazil)',
  O: 'Type O — 3 round pins (Thailand)',
};
