#!/usr/bin/env node
/**
 * Builds the pre-election data the app ships with, so the Pulse shows real figures before
 * anyone uploads anything. Uploads made later in the Data tab take precedence over it.
 *
 *   node scripts/build-pre-election-baseline.mjs \
 *     --survey Oyo_Polls.xlsx \
 *     --members "Polling-unit agents=Oyo_Polling_Unit_Records.xlsx" \
 *     --members "BSA-YV volunteers=BSA_YV_MEMBERS_MASTER.xlsx" \
 *     --contacts Raw_Phone_Number_Oyo.csv \
 *     --contact-center Contact_Center_Report.xlsx
 *
 * What is written (server/data/pre-election-baseline.json.gz) holds no names and no phone
 * numbers: the survey is the same anonymised dataset an upload produces (collectors are opaque
 * numbers), contacts are counts per LGA, and each member is a random token -- the same token for
 * the same person across lists, so the two lists still deduplicate, but not derivable from the
 * phone number the way an upload's keyed hash is.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { openCsvWorkbook, openWorkbook } from '../server/modules/voter-survey/xlsx.js';
import { buildSurveyDataset } from '../server/modules/voter-survey/import.js';
import { buildDataset } from '../server/modules/pre-election/datasets.js';

const args = process.argv.slice(2);
const option = (name) => args.flatMap((arg, i) => (arg === `--${name}` ? [args[i + 1]] : []));
const open = (file) => (/\.csv$/i.test(file) ? openCsvWorkbook(readFileSync(file)) : openWorkbook(readFileSync(file)));
const builtAt = new Date().toISOString();
const meta = (dataset, file) => ({ ...dataset, sourceFile: basename(file), uploadedBy: 'built-in', uploadedAt: builtAt, builtIn: true });

const datasets = [];
const tokens = new Map();
for (const spec of option('members')) {
  const [label, file] = spec.includes('=') ? spec.split(/=(.*)/s) : ['Members', spec];
  const dataset = buildDataset('members', open(file), { label });
  dataset.records = dataset.records.map(([lga, ward, unit, id]) => {
    if (!tokens.has(id)) tokens.set(id, randomBytes(9).toString('base64url'));
    return [lga, ward, unit, tokens.get(id)];
  });
  datasets.push(meta(dataset, file));
}
for (const file of option('contacts')) datasets.push(meta(buildDataset('contacts', open(file), { label: 'Contacts in our possession' }), file));
for (const file of option('contact-center')) datasets.push(meta(buildDataset('contact-center', open(file)), file));
for (const file of option('reference')) datasets.push(meta(buildDataset('reference', open(file)), file));

let survey = null;
const surveyFile = option('survey')[0];
if (surveyFile) {
  survey = buildSurveyDataset(open(surveyFile), { sourceFile: basename(surveyFile), importedBy: 'built-in' });
  // Written answers stay (the sentiment analysis reads them), minus anything shaped like a phone number.
  for (const field of ['impression', 'whyYes', 'whyNo', 'secondChoiceResponse']) {
    if (survey.values[field]) survey.values[field] = survey.values[field].map((text) => text.replace(/\+?\d[\d\s-]{6,}\d/g, '[number removed]'));
  }
  survey.builtIn = true;
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'data', 'pre-election-baseline.json.gz');
writeFileSync(out, gzipSync(JSON.stringify({ builtAt, survey, datasets })));
console.log(`Wrote ${out}`);
for (const dataset of datasets) console.log(`  ${dataset.kind.padEnd(15)} ${dataset.label}: ${JSON.stringify(dataset.summary).slice(0, 160)}`);
if (survey) console.log(`  survey          ${survey.responseCount} responses from ${survey.sourceFile}`);
