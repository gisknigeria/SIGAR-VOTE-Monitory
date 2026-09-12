import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeographicOperationalView, GeographyAccessDeniedError } from './operational-view.js';

function fixtureStore(overrides = {}) {
  const base = {
    async users() {
      return [
        { id: 'u1', name: 'Agent One', password: 'secret-hash', lga: 'IBADAN NORTH', ward: 'Ward 1', pollingUnit: '', lat: null, lng: null },
        { id: 'u2', name: 'Agent Two', password: 'secret-hash', lga: 'Atiba', ward: 'Ward 2', pollingUnit: '', lat: 7.1, lng: 3.5 },
      ];
    },
    async incidentsPage({ lga } = {}) {
      const items = [{ id: 'i1', lga: 'IBADAN NORTH', ward: 'Ward 1', media: [{ id: 'ev-1' }], lifecycle: { verifiedAt: '2026-09-10T09:00:00.000Z', verifiedBy: 'sup-1' } }].filter((item) => !lga || item.lga === lga);
      return { items, total: items.length, limit: 25, offset: 0 };
    },
    async resultRecordsPage({ lga } = {}) {
      const items = [{ id: 'r1', lga: 'IBADAN NORTH', ward: 'Ward 1', evidence: [{ id: 'ev-2' }] }].filter((item) => !lga || item.lga === lga);
      return { items, total: items.length, limit: 25, offset: 0 };
    },
    async tasks() {
      return [
        { id: 't1', status: 'completed', responseEvidence: [{ id: 'ev-3', type: 'note' }], geography: { lga: 'IBADAN NORTH', ward: 'Ward 1' } },
        { id: 't2', status: 'open', geography: { lga: 'Atiba', ward: 'Ward 2' } },
      ];
    },
    async intelligenceSignals() {
      return [
        { id: 's1', category: 'readiness', verificationStatus: 'verified', geography: { lga: 'IBADAN NORTH' } },
        { id: 's2', category: 'crm-issue', verificationStatus: 'unverified', geography: { lga: 'IBADAN NORTH' } },
        { id: 's3', category: 'safety', verificationStatus: 'unverified', geography: { lga: 'IBADAN NORTH' } },
      ];
    },
    async decisions() {
      return [{ id: 'd1', outcome: { status: 'resolved' } }, { id: 'd2', outcome: null }];
    },
    async resourceAdequacy() { return [{ resourceType: 'Radio', missing: 2 }]; },
    async resourceRequirements() { return [{ resourceType: 'Radio', quantity: 10 }]; },
    async connectivityAnalysis() { return { providers: [], measuredCount: 0, estimatedCount: 0 }; },
    async evidenceSummaries(ids) { return ids.map((id) => ({ id, status: 'available' })); },
  };
  return { ...base, ...overrides };
}

const allow = () => true;
const deny = () => false;

test('joins personnel, incidents, results, tasks, resources, connectivity and signals for a scope', async () => {
  const view = await buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Admin' }, canAccessGeography: allow, scope: { lga: 'IBADAN NORTH' } });
  assert.equal(view.personnel.items.length, 1);
  assert.equal(view.personnel.items[0].password, undefined);
  assert.equal(view.incidents.items.length, 1);
  assert.equal(view.results.items.length, 1);
  assert.equal(view.tasks.items.length, 1);
  assert.equal(view.readiness.total, 1);
  assert.equal(view.crmSignals.total, 1);
  assert.equal(view.metadata.otherSignalCount, 1);
  assert.equal(view.resources.adequacy[0].resourceType, 'Radio');
  assert.deepEqual(view.evidence.items.map((item) => item.id).sort(), ['ev-1', 'ev-2']);
});

test('preserves an unknown personnel coordinate as null instead of a default point', async () => {
  const view = await buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Admin' }, canAccessGeography: allow, scope: { lga: 'IBADAN NORTH' } });
  assert.equal(view.personnel.items[0].lat, null);
  assert.equal(view.personnel.items[0].lng, null);
});

test('drill-down level advances with the requested scope and rollups stop at polling unit', async () => {
  const stateLevel = await buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Admin' }, canAccessGeography: allow, scope: {} });
  assert.equal(stateLevel.drillDownLevel, 'lga');
  assert.ok(stateLevel.rollups.incidents.length >= 1);

  const fullyDrilled = await buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Admin' }, canAccessGeography: allow, scope: { lga: 'IBADAN NORTH', ward: 'WARD I N2', pollingUnit: 'AGBO COMPOUND' } });
  assert.equal(fullyDrilled.drillDownLevel, null);
  assert.equal(fullyDrilled.rollups, null);
});

test('outcomes summarize verified incidents, completed tasks and decision outcomes', async () => {
  const view = await buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Admin' }, canAccessGeography: allow, scope: { lga: 'IBADAN NORTH' } });
  assert.equal(view.outcomes.verifiedIncidents.total, 1);
  assert.equal(view.outcomes.completedTasks.total, 1);
  assert.equal(view.outcomes.decisionOutcomes.total, 1);
});

test('rejects a geography scope that is not a validated Oyo parent chain', async () => {
  await assert.rejects(
    buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Admin' }, canAccessGeography: allow, scope: { lga: 'Not A Real LGA' } }),
    /Unknown Oyo LGA/,
  );
});

test('denies a scope the actor is not authorized to view', async () => {
  await assert.rejects(
    buildGeographicOperationalView({ store: fixtureStore(), actor: { role: 'Agent', lga: 'Atiba' }, canAccessGeography: deny, scope: { lga: 'IBADAN NORTH' } }),
    GeographyAccessDeniedError,
  );
});

test('bounds every joined list to the requested page size', async () => {
  const manyUsers = Array.from({ length: 30 }, (_, index) => ({ id: `u${index}`, lga: 'IBADAN NORTH', ward: 'Ward 1', lat: null, lng: null }));
  const view = await buildGeographicOperationalView({
    store: fixtureStore({ async users() { return manyUsers; } }),
    actor: { role: 'Admin' },
    canAccessGeography: allow,
    scope: { lga: 'IBADAN NORTH' },
    limit: 5,
    offset: 0,
  });
  assert.equal(view.personnel.items.length, 5);
  assert.equal(view.personnel.total, 30);
});
