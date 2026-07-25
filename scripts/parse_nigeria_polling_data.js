import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = 'c:/Users/User/Downloads/Nigeria_Polling_Units.csv';
const outputPath = path.join(__dirname, '..', 'shared', 'nigeriaPollingData.js');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

const aliases = new Map([
  ['ABIA', 'Abia'],
  ['ADAMAWA', 'Adamawa'],
  ['AKWA IBOM', 'Akwa Ibom'],
  ['ANAMBRA', 'Anambra'],
  ['BAUCHI', 'Bauchi'],
  ['BAYELSA', 'Bayelsa'],
  ['BENUE', 'Benue'],
  ['BORNO', 'Borno'],
  ['CROSS RIVER', 'Cross River'],
  ['DELTA', 'Delta'],
  ['EBONYI', 'Ebonyi'],
  ['EDO', 'Edo'],
  ['EKITI', 'Ekiti'],
  ['ENUGU', 'Enugu'],
  ['FEDERAL CAPITAL TERRITORY (FCT)', 'FCT'],
  ['FCT', 'FCT'],
  ['GOMBE', 'Gombe'],
  ['IMO', 'Imo'],
  ['JIGAWA', 'Jigawa'],
  ['KADUNA', 'Kaduna'],
  ['KANO', 'Kano'],
  ['KATSINA', 'Katsina'],
  ['KEBBI', 'Kebbi'],
  ['KOGI', 'Kogi'],
  ['KWARA', 'Kwara'],
  ['LAGOS', 'Lagos'],
  ['NASARAWA', 'Nasarawa'],
  ['NIGER', 'Niger'],
  ['OGUN', 'Ogun'],
  ['ONDO', 'Ondo'],
  ['OSUN', 'Osun'],
  ['OYO', 'Oyo'],
  ['PLATEAU', 'Plateau'],
  ['RIVERS', 'Rivers'],
  ['SOKOTO', 'Sokoto'],
  ['TARABA', 'Taraba'],
  ['YOBE', 'Yobe'],
  ['ZAMFARA', 'Zamfara'],
]);

function normalizeStateName(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  if (aliases.has(upper)) {
    return aliases.get(upper);
  }
  return raw.replace(/\s+/g, ' ').trim();
}

const text = fs.readFileSync(sourcePath, 'utf8');
const lines = text.trim().split(/\r?\n/).filter(Boolean);
const [headerLine, ...dataLines] = lines;
const headers = parseCsvLine(headerLine).map((header) => header.trim().toLowerCase());

const getColumnIndex = (matchers) => {
  for (const matcher of matchers) {
    const exact = headers.findIndex((header) => header === matcher);
    if (exact >= 0) return exact;
  }
  for (const matcher of matchers) {
    const found = headers.findIndex((header) => header.includes(matcher));
    if (found >= 0) return found;
  }
  return -1;
};

const stateNameIndex = getColumnIndex(['state / fct']);
const stateCodeIndex = getColumnIndex(['state code']);
const lgaNameIndex = getColumnIndex(['local government area']);
const wardNameIndex = getColumnIndex(['registration area / ward']);
const unitNameIndex = getColumnIndex(['polling unit name / location']);

if ([stateNameIndex, stateCodeIndex, lgaNameIndex, wardNameIndex, unitNameIndex].some((index) => index < 0)) {
  console.error('Unable to find all required columns in CSV header:', headers);
  process.exit(1);
}

const rows = dataLines
  .map(parseCsvLine)
  .filter(
    (columns) =>
      columns.length >=
      Math.max(stateNameIndex + 1, stateCodeIndex + 1, lgaNameIndex + 1, wardNameIndex + 1, unitNameIndex + 1),
  )
  .map((columns) => ({
    stateName: String(columns[stateNameIndex] || '').trim(),
    stateCode: String(columns[stateCodeIndex] || '').trim(),
    lga: String(columns[lgaNameIndex] || '').trim(),
    ward: String(columns[wardNameIndex] || '').trim(),
    unitName: String(columns[unitNameIndex] || '').trim(),
  }))
  .filter((row) => row.stateName && row.lga && row.ward && row.unitName);

const data = {};
const stateCodeToName = new Map();
for (const row of rows) {
  const state = normalizeStateName(row.stateName);
  const code = row.stateCode;
  if (code) {
    stateCodeToName.set(code, state);
  }

  const lga = row.lga.replace(/\s+/g, ' ').trim();
  const ward = row.ward.replace(/\s+/g, ' ').trim();
  const unitName = row.unitName.replace(/\s+/g, ' ').trim();

  if (!data[state]) {
    data[state] = {};
  }
  if (!data[state][lga]) {
    data[state][lga] = {};
  }
  if (!data[state][lga][ward]) {
    data[state][lga][ward] = new Set();
  }
  data[state][lga][ward].add(unitName);
}

const sortedEntries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
const stateNames = sortedEntries.map(([state]) => state);

const linesOut = [];
linesOut.push('export const NIGERIA_REGISTRATION_LOCATION_DATA = {');
for (const [state, lgas] of sortedEntries) {
  linesOut.push(`  ${JSON.stringify(state)}: {`);
  linesOut.push('    lgas: {');
  for (const [lga, wards] of Object.entries(lgas).sort(([a], [b]) => a.localeCompare(b))) {
    linesOut.push(`      ${JSON.stringify(lga)}: {`);
    linesOut.push('        wards: {');
    for (const [ward, units] of Object.entries(wards).sort(([a], [b]) => a.localeCompare(b))) {
      const sortedUnits = Array.from(units).sort((a, b) => a.localeCompare(b));
      linesOut.push(`          ${JSON.stringify(ward)}: ${JSON.stringify(sortedUnits)},`);
    }
    linesOut.push('        },');
    linesOut.push('      },');
  }
  linesOut.push('    },');
  linesOut.push('  },');
}
linesOut.push('};');
linesOut.push('');
linesOut.push(`export const NIGERIA_STATES = ${JSON.stringify(stateNames)};`);
linesOut.push('export const DEFAULT_REGISTRATION_STATE = "Oyo";');
linesOut.push('');
linesOut.push('export const STATE_CODE_TO_NAME = {');
for (const [code, name] of Array.from(stateCodeToName.entries()).sort(([a], [b]) => Number(a) - Number(b))) {
  linesOut.push(`  ${JSON.stringify(code)}: ${JSON.stringify(name)},`);
}
linesOut.push('};');
linesOut.push('');
linesOut.push('export const normalizeRegistrationState = (state) => {');
linesOut.push('  const raw = String(state || DEFAULT_REGISTRATION_STATE).trim();');
linesOut.push('  const mapped = STATE_CODE_TO_NAME[raw] || raw;');
linesOut.push('  return NIGERIA_REGISTRATION_LOCATION_DATA[mapped] ? mapped : DEFAULT_REGISTRATION_STATE;');
linesOut.push('};');
linesOut.push('');
linesOut.push('export const getRegistrationLocationOptions = (state, lga = "", ward = "") => {');
linesOut.push('  const normalizedState = normalizeRegistrationState(state);');
linesOut.push('  const selectedState = NIGERIA_REGISTRATION_LOCATION_DATA[normalizedState];');
linesOut.push('  const lgaOptions = selectedState ? Object.keys(selectedState.lgas).sort((a, b) => a.localeCompare(b)) : [];');
linesOut.push('  const wardOptions = lga && selectedState?.lgas[lga] ? Object.keys(selectedState.lgas[lga].wards).sort((a, b) => a.localeCompare(b)) : [];');
linesOut.push('  const pollingUnits = ward && selectedState?.lgas[lga]?.wards[ward] ? selectedState.lgas[lga].wards[ward] : lga && selectedState?.lgas[lga] ? Object.values(selectedState.lgas[lga].wards).flat() : [];');
linesOut.push('  return {');
linesOut.push('    lgas: lgaOptions,');
linesOut.push('    wards: wardOptions,');
linesOut.push('    pollingUnits,');
linesOut.push('  };');
linesOut.push('};');

fs.writeFileSync(outputPath, `${linesOut.join('\n')}\n`);
console.log(`Wrote ${outputPath}`);
console.log(`States: ${stateNames.length}`);
console.log(`Abia sample: ${JSON.stringify({ lgas: Object.keys(data.Abia || {}).slice(0, 5), wards: Object.keys(data.Abia?.['ABA NORTH']?.wards || {}).slice(0, 5), pollingUnits: Object.values(data.Abia?.['ABA NORTH']?.wards || {})?.[0]?.slice(0, 5) || [] })}`);

fs.writeFileSync(outputPath, `${linesOut.join('\n')}\n`);
console.log(`Wrote ${outputPath}`);
console.log(`States: ${stateNames.length}`);
console.log(`Abia sample: ${JSON.stringify({ lgas: Array.from(data.Abia?.lgas || []).slice(0, 5), wards: Array.from(data.Abia?.wards || []).slice(0, 5), pollingUnits: Array.from(data.Abia?.pollingUnits || []).slice(0, 5) })}`);
