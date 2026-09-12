// Benchmarks the geographic operational view (item 22) against the real,
// composed repository stack in JSON-store mode. This machine has no live
// Postgres instance, so this measures the JSON fallback path only; the
// Postgres path is expected to be faster for the incidents/results queries
// (they use bounded SQL LIMIT/OFFSET there) and slower for the still
// key-value-backed domains (signals/decisions/resources/connectivity/tasks),
// which round-trip through `app_settings` regardless of store backend. Re-run
// this script with DATABASE_URL set against a representative database before
// treating these numbers as production capacity evidence.
import { createStore } from '../server/store.js';
import { createMappers } from '../server/infrastructure/persistence/mappers.js';
import { createAccessPolicy } from '../server/modules/identity/access-policy.js';
import { buildGeographicOperationalView } from '../server/modules/geography/operational-view.js';
import { NIGERIA_REGISTRATION_LOCATION_DATA } from '../shared/nigeriaPollingData.js';

const RECORD_COUNT = Number(process.argv[2] || 5000);
const ITERATIONS = Number(process.argv[3] || 20);

const oyoLgas = Object.keys(NIGERIA_REGISTRATION_LOCATION_DATA.Oyo.lgas);
const wardsFor = (lga) => Object.keys(NIGERIA_REGISTRATION_LOCATION_DATA.Oyo.lgas[lga].wards);
const pollingUnitsFor = (lga, ward) => NIGERIA_REGISTRATION_LOCATION_DATA.Oyo.lgas[lga].wards[ward];

const benchmarkLga = oyoLgas[0];
const benchmarkWard = wardsFor(benchmarkLga)[0];
const benchmarkPollingUnit = pollingUnitsFor(benchmarkLga, benchmarkWard)[0];

function pick(list, index) { return list[index % list.length]; }

function buildSyntheticDb(count) {
  const incidents = [];
  const resultRecords = [];
  const users = [];
  const tasks = {};
  const intelligenceSignals = {};
  const intelligenceDecisions = {};
  const resourceIntelligence = {};

  for (let index = 0; index < count; index += 1) {
    const lga = pick(oyoLgas, index);
    const ward = pick(wardsFor(lga), index);
    const pollingUnit = pick(pollingUnitsFor(lga, ward), index);
    const geography = { state: 'Oyo', lga, ward, pollingUnit };
    const now = new Date(Date.now() - index * 1000).toISOString();

    incidents.push({ id: `bench-i-${index}`, title: `Incident ${index}`, status: index % 5 === 0 ? 'closed' : 'reported', lga, ward, pollingUnit, media: [], lifecycle: {}, createdAt: now });
    resultRecords.push({ id: `bench-r-${index}`, submissionId: `bench-sub-${index}`, lga, ward, pollingUnit, evidence: [], geography, createdAt: now });
    users.push({ id: `bench-u-${index}`, name: `Agent ${index}`, password: 'hash', role: 'Agent', active: true, lga, ward, pollingUnit, lat: index % 7 === 0 ? null : 7 + (index % 100) / 1000, lng: index % 7 === 0 ? null : 3 + (index % 100) / 1000 });
    tasks[`task:bench-t-${index}`] = { id: `bench-t-${index}`, status: index % 4 === 0 ? 'completed' : 'open', geography, createdAt: now };
    intelligenceSignals[`intelligence-signal:bench-s-${index}`] = { id: `bench-s-${index}`, sourceEventId: `bench-s-${index}`, category: index % 3 === 0 ? 'readiness' : 'safety', geography, verificationStatus: 'unverified' };
    if (index % 10 === 0) intelligenceDecisions[`intelligence-decision:bench-d-${index}`] = { id: `bench-d-${index}`, stage: 'proposed', geography, outcome: null };
    if (index % 6 === 0) resourceIntelligence[`resource-intelligence:bench-res-${index}`] = { id: `bench-res-${index}`, kind: 'requirement', resourceType: 'Radio', quantity: 1, geography };
  }

  return { incidents, resultRecords, users, tasks, intelligenceSignals, intelligenceDecisions, resourceIntelligence, connectivityDatasets: {}, crmSync: {}, privateEvidence: {} };
}

function timeit(fn) {
  const start = process.hrtime.bigint();
  return fn().then(() => Number(process.hrtime.bigint() - start) / 1e6);
}

async function benchmarkScope(store, canAccessGeography, label, scope) {
  const durations = [];
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    durations.push(await timeit(() => buildGeographicOperationalView({ store, actor: { role: 'Admin' }, canAccessGeography, scope, limit: 25 })));
  }
  durations.sort((a, b) => a - b);
  const min = durations[0];
  const max = durations[durations.length - 1];
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)];
  console.log(`${label.padEnd(28)} min=${min.toFixed(2)}ms avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${max.toFixed(2)}ms (n=${ITERATIONS})`);
}

async function main() {
  console.log(`Building ${RECORD_COUNT} synthetic records per domain across real Oyo geography (JSON-store mode)...`);
  const jsonDb = buildSyntheticDb(RECORD_COUNT);
  const mappers = createMappers({});
  const store = createStore({ pool: null, jsonDb, saveJson: () => {}, mappers });
  const { canAccessGeography } = createAccessPolicy({ io: { sockets: { sockets: new Map() } } });

  console.log(`\nGeographic operational view benchmark (${RECORD_COUNT} records/domain, ${ITERATIONS} iterations each):`);
  await benchmarkScope(store, canAccessGeography, 'state-wide (no lga)', {});
  await benchmarkScope(store, canAccessGeography, `lga: ${benchmarkLga}`, { lga: benchmarkLga });
  await benchmarkScope(store, canAccessGeography, `ward: ${benchmarkWard}`, { lga: benchmarkLga, ward: benchmarkWard });
  await benchmarkScope(store, canAccessGeography, `polling unit: ${benchmarkPollingUnit}`, { lga: benchmarkLga, ward: benchmarkWard, pollingUnit: benchmarkPollingUnit });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
