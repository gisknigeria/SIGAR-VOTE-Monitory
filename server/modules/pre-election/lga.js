import { getRegistrationLocationOptions } from '../../../shared/electionData.js';

/**
 * The 33 Oyo LGAs as the bundled INEC register names them, and a matcher that maps the many
 * spellings found in campaign spreadsheets ("OGBOMOSHO NORTH LG", "Ori Ire", "IB SOUTHWEST LG",
 * "IBADAN SOUTH- EAST") onto them. Anything it cannot place is reported back, never guessed.
 */

const squash = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Keyed by squashed spelling. Only spellings seen in real uploads, each checked by hand.
const VARIANTS = {
  atigbo: 'atisbo',
  ogbomoshonorth: 'ogbomosonorth',
  ogbomoshosouth: 'ogbomososouth',
  orelope: 'oorelope',
  oriire: 'oriire',
  ibsouthwest: 'ibadansouthwest',
  ibsoutheast: 'ibadansoutheast',
  ibnorth: 'ibadannorth',
  ibnortheast: 'ibadannortheast',
  ibnorthwest: 'ibadannorthwest',
  suurulere: 'surulere',
  ogooluwa: 'ogooluwa',
  onaara: 'onaara',
};

let cache = null;
function register() {
  if (cache) return cache;
  const lgas = getRegistrationLocationOptions('Oyo').lgas.map((name) => {
    const wards = getRegistrationLocationOptions('Oyo', name).wards;
    const pollingUnits = wards.reduce((sum, ward) => sum + getRegistrationLocationOptions('Oyo', name, ward).pollingUnits.length, 0);
    return { name, key: squash(name), wards: wards.length, pollingUnits };
  });
  cache = { lgas, byKey: new Map(lgas.map((lga) => [lga.key, lga])) };
  return cache;
}

export const oyoLgas = () => register().lgas;

/** Canonical register name for any spelling, or '' when it is not an Oyo LGA. */
export function matchLga(value) {
  let key = squash(String(value ?? '').replace(/\b(local\s+government(\s+area)?|l\.?\s?g\.?\s?a?\.?)\s*$/i, ''));
  if (!key) return '';
  key = VARIANTS[key] || key;
  return register().byKey.get(key)?.name || '';
}

/** Display form: "IBADAN NORTH EAST" -> "Ibadan North East". */
export const lgaLabel = (name) => String(name || '').toLowerCase().replace(/(^|[\s-])([a-z])/g, (match, lead, char) => lead + char.toUpperCase());
