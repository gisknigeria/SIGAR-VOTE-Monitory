/**
 * Loads real, sourced Oyo State demographic datasets into the running API's
 * demographics module (population by LGA -- 2006 census and a 2022
 * projection -- plus the state-level 2023 registered-voter total).
 *
 * No LGA-level or ward-level registered-voter breakdown is included: as of
 * 2026-09-13, no such breakdown was found in any freely accessible source.
 * Do not interpolate one from the state total or from population figures.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:5000/api ADMIN_EMAIL=admin@command.local ADMIN_PASSWORD=... node scripts/seed-oyo-demographics.mjs
 *
 * Safe to re-run: each run creates a new dataset version rather than
 * mutating an existing one, matching the module's append-only design.
 */

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables to an Admin or Super Admin account.');
  process.exit(1);
}

// Source: https://www.citypopulation.de/en/nigeria/admin/NGA031__oyo/
// Canonical LGA spellings match shared/electionData.js getRegistrationLocationOptions('Oyo').lgas
const LGA_POPULATION_2006_CENSUS = {
  AFIJIO: 132184, AKINYELE: 211811, ATIBA: 168246, ATISBO: 109965, EGBEDA: 283643,
  'IBADAN NORTH': 308119, 'IBADAN NORTH EAST': 331444, 'IBADAN NORTH WEST': 154029,
  'IBADAN SOUTH-EAST': 266457, 'IBADAN SOUTH WEST': 283098,
  'IBARAPA CENTRAL': 103243, 'IBARAPA EAST': 117182, 'IBARAPA NORTH': 100293,
  IDO: 104087, IREPO: 121240, ISEYIN: 255619, ITESIWAJU: 127391, IWAJOWA: 102847,
  KAJOLA: 200528, LAGELU: 148133, 'OGBOMOSO NORTH': 198859, 'OGBOMOSO SOUTH': 100379,
  'OGO-OLUWA': 65198, OLORUNSOGO: 81339, OLUYOLE: 203461, 'ONA-ARA': 265571,
  OORELOPE: 104004, 'ORI IRE': 149408, 'OYO EAST': 124095, 'OYO WEST': 136457,
  'SAKI EAST': 108957, 'SAKI WEST': 273268, SURULERE: 140339,
};

const LGA_POPULATION_2022_PROJECTION = {
  AFIJIO: 188900, AKINYELE: 302700, ATIBA: 240500, ATISBO: 157200, EGBEDA: 405400,
  'IBADAN NORTH': 440400, 'IBADAN NORTH EAST': 473700, 'IBADAN NORTH WEST': 220100,
  'IBADAN SOUTH-EAST': 380800, 'IBADAN SOUTH WEST': 404600,
  'IBARAPA CENTRAL': 147600, 'IBARAPA EAST': 167500, 'IBARAPA NORTH': 143300,
  IDO: 148800, IREPO: 173300, ISEYIN: 365300, ITESIWAJU: 182100, IWAJOWA: 147000,
  KAJOLA: 286600, LAGELU: 211700, 'OGBOMOSO NORTH': 284200, 'OGBOMOSO SOUTH': 143500,
  'OGO-OLUWA': 93200, OLORUNSOGO: 116200, OLUYOLE: 290800, 'ONA-ARA': 379500,
  OORELOPE: 148600, 'ORI IRE': 213500, 'OYO EAST': 177400, 'OYO WEST': 195000,
  'SAKI EAST': 155700, 'SAKI WEST': 390500, SURULERE: 200600,
};

const toRecords = (map) => Object.entries(map).map(([lga, value]) => ({ geography: { state: 'Oyo', lga }, value, unit: 'persons' }));

async function post(token, path, body) {
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function ingestAndApprove(token, payload) {
  const dataset = await post(token, '/demographics/datasets', payload);
  await post(token, `/demographics/datasets/${dataset.id}/approve`, {});
  return dataset;
}

async function main() {
  const loginRes = await fetch(API_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);
  const token = login.token;

  const census = await ingestAndApprove(token, {
    sourceId: 'citypopulation-de-oyo-2006-census',
    sourceName: 'citypopulation.de compilation of Nigeria 2006 National Population Census',
    sourceUrl: 'https://www.citypopulation.de/en/nigeria/admin/NGA031__oyo/',
    sourceVersion: '2006-census',
    metric: 'population',
    resolution: 'lga',
    publicationDate: '2006-03-21',
    methodology: 'Nigeria National Population Commission 2006 census enumeration (21-27 March 2006), as compiled and republished by the independent demographic reference site citypopulation.de. This is a secondary compilation, not a direct NPC or INEC publication -- verify against NPC records before high-stakes use.',
    uncertainty: 'Third-party compilation of official census counts; LGA boundaries as of the 2006 census.',
    records: toRecords(LGA_POPULATION_2006_CENSUS),
  });
  console.log('Ingested and approved 2006 census population dataset:', census.id);

  const projection = await ingestAndApprove(token, {
    sourceId: 'citypopulation-de-oyo-2022-projection',
    sourceName: 'citypopulation.de population projection for Oyo State LGAs',
    sourceUrl: 'https://www.citypopulation.de/en/nigeria/admin/NGA031__oyo/',
    sourceVersion: '2022-projection',
    metric: 'population',
    resolution: 'lga',
    publicationDate: '2022-01-01',
    methodology: 'Independent growth-rate projection from the 2006 census by citypopulation.de, not an official NPC projection. Retrieved 2026-09-13. Treat as an estimate, not a count.',
    uncertainty: 'Projection methodology and growth-rate assumptions are set by citypopulation.de, not verified against an official NPC projection.',
    records: toRecords(LGA_POPULATION_2022_PROJECTION),
  });
  console.log('Ingested and approved 2022 projection population dataset:', projection.id);

  const voters = await ingestAndApprove(token, {
    sourceId: 'inec-oyo-2023-total-registered-voters',
    sourceName: 'INEC total registered voters, Oyo State, 2023 general election',
    sourceUrl: '',
    sourceVersion: '2023-general-election',
    metric: 'registered-voters',
    resolution: 'state',
    publicationDate: '2023-01-01',
    methodology: 'State-level total reported by INEC/press coverage ahead of the 2023 general election. No official LGA-level or ward-level breakdown was found in any freely accessible source as of 2026-09-13 -- do not interpolate one from this figure.',
    uncertainty: 'State-level total only. No verified LGA or ward breakdown exists in this dataset.',
    records: [{ geography: { state: 'Oyo' }, value: 3276675, unit: 'persons' }],
  });
  console.log('Ingested and approved state-level registered-voters dataset:', voters.id);
}

main().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
