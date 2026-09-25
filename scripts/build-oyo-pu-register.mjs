#!/usr/bin/env node
/**
 * Packs Oyo's 6,390 polling units (INEC code, ward, name, registered and accredited voters, and
 * the 2023 presidential result where a sheet was transcribed) into
 * server/data/oyo-pu-register-2023.json.gz for the sentiment map.
 *
 *   node scripts/build-oyo-pu-register.mjs [.tmp-election-workbook]
 *
 * Source: the IReV transcription export in .tmp-election-workbook (crosschecked, unsure and
 * not-found sheets). "status" keeps that distinction: c = crosschecked, u = unsure, n = no sheet.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] || join(root, '.tmp-election-workbook');

function parseCsv(text) {
  const rows = [];
  let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])));
}

const int = (value) => { const n = Math.round(Number(value)); return Number.isFinite(n) && n > 0 ? n : 0; };
const units = [];
for (const [file, status] of [['OYO_crosschecked.csv', 'c'], ['OYO_unsure.csv', 'u'], ['OYO_notfound.csv', 'n']]) {
  for (const row of parseCsv(readFileSync(join(dir, file), 'utf8'))) {
    const [, lgaCode, wardCode, puCode] = String(row['PU-Code']).split('-');
    if (!puCode) continue;
    const found = status !== 'n' && /^true$/i.test(String(row.Results_Found));
    units.push([
      lgaCode, wardCode, puCode, row.LGA.trim(), row.Ward.trim(), row['PU-Name'].trim(),
      int(row.Registered_Voters), int(row.Accredited_Voters),
      found ? [int(row.APC), int(row.PDP), int(row.LP), int(row.NNPP)] : null,
      status,
    ]);
  }
}
units.sort((a, b) => `${a[0]}${a[1]}${a[2]}`.localeCompare(`${b[0]}${b[1]}${b[2]}`));
const out = join(root, 'server', 'data', 'oyo-pu-register-2023.json.gz');
writeFileSync(out, gzipSync(JSON.stringify({
  source: 'INEC IReV 2023 presidential result sheets, transcribed (crosschecked / unsure / not found)',
  fields: ['lgaCode', 'wardCode', 'puCode', 'lga', 'ward', 'name', 'registered', 'accredited', 'presidential [APC, PDP, LP, NNPP]', 'status'],
  units,
})));
console.log(`Wrote ${units.length} polling units to ${out}`);
