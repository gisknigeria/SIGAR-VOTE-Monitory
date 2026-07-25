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
  const index = headers.findIndex((header) => matchers.some((matcher) => header.includes(matcher)));
  return index >= 0 ? index : -1;
};

const stateIndex = getColumnIndex(['state / fct', 'state']);
const lgaIndex = getColumnIndex(['local government area', 'lga']);
const wardIndex = getColumnIndex(['registration area / ward', 'ward']);
const unitIndex = getColumnIndex(['polling unit name / location', 'polling unit name', 'polling unit']);

const rows = dataLines
  .map(parseCsvLine)
  .filter((columns) => columns.length >= Math.max(stateIndex + 1, lgaIndex + 1, wardIndex + 1, unitIndex + 1))
  .map((columns) => ({
    state: String(columns[stateIndex] || '').trim(),
    lga: String(columns[lgaIndex] || '').trim(),
    ward: String(columns[wardIndex] || '').trim(),
    unitName: String(columns[unitIndex] || '').trim(),
  }))
  .filter((row) => row.state && row.lga && row.ward && row.unitName);

const data = {};
for (const row of rows) {
  const state = normalizeStateName(row.state);
  const lga = row.lga.replace(/\s+/g, ' ').trim();
  const ward = row.ward.replace(/\s+/g, ' ').trim();
  const unitName = row.unitName.replace(/\s+/g, ' ').trim();

  if (!data[state]) {
    data[state] = { lgas: new Set(), wards: new Set(), pollingUnits: new Set() };
  }

  data[state].lgas.add(lga);
  data[state].wards.add(ward);
  data[state].pollingUnits.add(unitName);
}

const sortedEntries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
const stateNames = sortedEntries.map(([state]) => state);

const linesOut = [];
linesOut.push('export const NIGERIA_REGISTRATION_LOCATION_DATA = {');
for (const [state, value] of sortedEntries) {
  const lgas = Array.from(value.lgas).sort((a, b) => a.localeCompare(b));
  const wards = Array.from(value.wards).sort((a, b) => a.localeCompare(b));
  const pollingUnits = Array.from(value.pollingUnits).sort((a, b) => a.localeCompare(b)).slice(0, 80);
  linesOut.push(`  ${JSON.stringify(state)}: {`);
  linesOut.push(`    lgas: ${JSON.stringify(lgas)},`);
  linesOut.push(`    wards: ${JSON.stringify(wards)},`);
  linesOut.push(`    pollingUnits: ${JSON.stringify(pollingUnits)},`);
  linesOut.push('  },');
}
linesOut.push('};');
linesOut.push('');
linesOut.push(`export const NIGERIA_STATES = ${JSON.stringify(stateNames)};`);
linesOut.push('export const DEFAULT_REGISTRATION_STATE = "Oyo";');
linesOut.push('');
linesOut.push('export const normalizeRegistrationState = (state) => {');
linesOut.push('  const normalized = String(state || DEFAULT_REGISTRATION_STATE).trim();');
linesOut.push('  return NIGERIA_REGISTRATION_LOCATION_DATA[normalized] ? normalized : DEFAULT_REGISTRATION_STATE;');
linesOut.push('};');
linesOut.push('');
linesOut.push('export const getRegistrationLocationOptions = (state) => {');
linesOut.push('  const normalizedState = normalizeRegistrationState(state);');
linesOut.push('  const selected = NIGERIA_REGISTRATION_LOCATION_DATA[normalizedState];');
linesOut.push('  return {');
linesOut.push('    lgas: selected?.lgas || [],');
linesOut.push('    wards: selected?.wards || [],');
linesOut.push('    pollingUnits: selected?.pollingUnits || [],');
linesOut.push('  };');
linesOut.push('};');

fs.writeFileSync(outputPath, `${linesOut.join('\n')}\n`);
console.log(`Wrote ${outputPath}`);
console.log(`States: ${stateNames.length}`);
console.log(`Abia sample: ${JSON.stringify({ lgas: Array.from(data.Abia?.lgas || []).slice(0, 5), wards: Array.from(data.Abia?.wards || []).slice(0, 5), pollingUnits: Array.from(data.Abia?.pollingUnits || []).slice(0, 5) })}`);
