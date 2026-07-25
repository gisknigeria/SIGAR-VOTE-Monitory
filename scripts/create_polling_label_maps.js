import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = path.resolve('C:/Users/User/Downloads/Nigeria_Polling_Units.csv');
const outputPath = path.resolve(__dirname, '..', 'shared', 'nigeriaPollingLabels.js');

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
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim());
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Source CSV not found: ${sourcePath}`);
  process.exit(1);
}

const text = fs.readFileSync(sourcePath, 'utf8');
const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

const findIndex = (keys) => {
  return keys.reduce((found, key) => {
    if (found >= 0) return found;
    return header.findIndex((h) => h.includes(key));
  }, -1);
};

const stateIndex = findIndex(['state / fct', 'state']);
const stateNameIndex = findIndex(['state / fct', 'state']);
const lgaCodeIndex = findIndex(['lga code', 'lga']);
const lgaNameIndex = findIndex(['local government area', 'local government', 'lga']);
const wardCodeIndex = findIndex(['ward / ra code', 'ward code']);
const wardNameIndex = findIndex(['registration area / ward', 'registration area', 'ward']);
const pollingCodeIndex = findIndex(['polling unit code', 'polling unit code', 'polling unit']);
const pollingNameIndex = findIndex(['polling unit name / location', 'polling unit name', 'polling unit']);

if ([stateIndex, lgaCodeIndex, lgaNameIndex, wardCodeIndex, wardNameIndex, pollingCodeIndex, pollingNameIndex].some((i) => i < 0)) {
  console.error('Unable to find all required columns in CSV header:', header);
  process.exit(1);
}

const stateNames = new Map();
const lgaNames = {};
const wardNames = {};
const pollingUnitNames = {};

for (let i = 1; i < lines.length; i += 1) {
  const row = parseCsvLine(lines[i]);
  if (row.length <= Math.max(stateIndex, lgaCodeIndex, lgaNameIndex, wardCodeIndex, wardNameIndex, pollingCodeIndex, pollingNameIndex)) continue;

  const stateCode = row[stateIndex].trim();
  const stateName = row[stateNameIndex].trim();
  const lgaCode = row[lgaCodeIndex].trim();
  const lgaName = row[lgaNameIndex].trim();
  const wardCode = row[wardCodeIndex].trim();
  const wardName = row[wardNameIndex].trim();
  const pollingCode = row[pollingCodeIndex].trim();
  const pollingName = row[pollingNameIndex].trim();

  if (!stateCode || !lgaCode || !wardCode || !pollingCode) continue;

  if (!stateNames.has(stateCode)) {
    stateNames.set(stateCode, stateName || stateCode);
  }

  lgaNames[stateCode] = lgaNames[stateCode] || {};
  if (!lgaNames[stateCode][lgaCode]) lgaNames[stateCode][lgaCode] = lgaName || lgaCode;

  wardNames[stateCode] = wardNames[stateCode] || {};
  wardNames[stateCode][lgaCode] = wardNames[stateCode][lgaCode] || {};
  if (!wardNames[stateCode][lgaCode][wardCode]) wardNames[stateCode][lgaCode][wardCode] = wardName || wardCode;

  if (!pollingUnitNames[pollingCode]) {
    pollingUnitNames[pollingCode] = pollingName || pollingCode;
  }
}

const serialize = (value) => JSON.stringify(value, null, 2);
const output = `export const POLLING_UNIT_LABELS = ${serialize(pollingUnitNames)};
export const STATE_LABELS = ${serialize(Object.fromEntries(stateNames.entries()))};
export const LGA_LABELS = ${serialize(lgaNames)};
export const WARD_LABELS = ${serialize(wardNames)};
`;
fs.writeFileSync(outputPath, output + '\n', 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`States: ${stateNames.size}`);
` }]}