import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldOperationsRepository } from './repository.js';

function fixture() {
  const jsonDb = { settings: {}, cameras: [] };
  return createFieldOperationsRepository({
    pool: null,
    jsonDb,
    saveJson() {},
    mappers: { toCamera: (row) => row },
  });
}

const geography = { state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1' };

test('resource dashboard reports required, available, deployed, missing, and underutilized by geography', async () => {
  const repository = fixture();
  await repository.createResourceRequirement({ resourceType: 'Radio', quantity: 10, geography, forecastDate: '2026-10-01' });
  await repository.recordResourceAvailability({ resourceType: 'Radio', quantity: 8, geography });
  const deployment = await repository.dispatchResource({ resourceType: 'Radio', quantity: 4, geography, sourceGeography: { state: 'Oyo', lga: 'Ibadan North' }, approvedBy: 'admin-1' });
  await repository.confirmResourceArrival(deployment.id, { quantity: 4 });
  await repository.reviewResourceUtilization(deployment.id, { utilizationStatus: 'underutilized', usedQuantity: 1, reviewedBy: 'supervisor-1' });

  const dashboard = await repository.resourceDashboard(geography);
  assert.deepEqual(dashboard.resources, [{
    resourceType: 'Radio',
    unit: 'units',
    required: 10,
    available: 8,
    deployed: 4,
    arrived: 4,
    missing: 6,
    underutilized: 4,
  }]);
  assert.equal(dashboard.requirements.length, 1);
});

test('resourceRecords exposes raw, actionable records with IDs, grouped by kind and geography-scoped', async () => {
  const repository = fixture();
  const requirement = await repository.createResourceRequirement({ resourceType: 'Radio', quantity: 10, geography, forecastDate: '2026-10-01' });
  await repository.recordResourceAvailability({ resourceType: 'Radio', quantity: 8, geography });
  const deployment = await repository.dispatchResource({ resourceType: 'Radio', quantity: 4, geography, sourceGeography: { state: 'Oyo', lga: 'Ibadan North' }, approvedBy: 'admin-1' });
  await repository.createResourceRequirement({ resourceType: 'Vehicle', quantity: 2, geography: { state: 'Oyo', lga: 'Atiba' }, forecastDate: '2026-10-01' });

  const records = await repository.resourceRecords(geography);
  assert.equal(records.requirement.length, 1);
  assert.equal(records.requirement[0].id, requirement.id);
  assert.equal(records.availability.length, 1);
  assert.equal(records.deployment.length, 1);
  assert.equal(records.deployment[0].id, deployment.id);
  assert.equal(records.reservation.length, 0);
});

test('arrival confirmation, reallocation, and utilization review update deployment state', async () => {
  const repository = fixture();
  await repository.recordResourceAvailability({ resourceType: 'Generator', quantity: 2, geography });
  const deployment = await repository.dispatchResource({ resourceType: 'Generator', quantity: 2, geography, approvedBy: 'admin-1' });
  const arrived = await repository.confirmResourceArrival(deployment.id, { quantity: 2, confirmedBy: 'agent-1' });
  assert.equal(arrived.arrivalStatus, 'arrived');
  const moved = await repository.reallocateResource(deployment.id, { geography: { state: 'Oyo', lga: 'Atiba', ward: 'Ward 2' }, reason: 'higher demand', updatedBy: 'admin-1' });
  assert.equal(moved.geography.lga, 'Atiba');
  const reviewed = await repository.reviewResourceUtilization(deployment.id, { utilizationStatus: 'adequate', usedQuantity: 2, reviewedBy: 'admin-1' });
  assert.equal(reviewed.utilizationStatus, 'adequate');
  assert.equal((await repository.resourceAdequacy({ lga: 'Ibadan North' }))[0].deployed, 0);
  assert.equal((await repository.resourceAdequacy({ lga: 'Atiba' }))[0].deployed, 2);
});

test('inventory prevents over-dispatch and preserves original quantity across partial arrivals and returns', async () => {
  const repository = fixture();
  await repository.recordResourceAvailability({ resourceType: 'Radio', quantity: 5, geography });
  await assert.rejects(repository.dispatchResource({ resourceType: 'Radio', quantity: 6, geography, approvedBy: 'admin-1' }), /Insufficient/);
  const deployment = await repository.dispatchResource({ resourceType: 'Radio', quantity: 5, geography, approvedBy: 'admin-1' });
  const partial = await repository.confirmResourceArrival(deployment.id, { quantity: 2, confirmedBy: 'agent-1' });
  assert.equal(partial.originalQuantity, 5);
  assert.equal(partial.arrivalStatus, 'partial');
  assert.equal(partial.arrivedQuantity, 2);
  const returned = await repository.returnResource(deployment.id, { quantity: 1, returnedBy: 'agent-1', reason: 'unused' });
  assert.equal(returned.returnedQuantity, 1);
  assert.ok(returned.movementHistory.some((entry) => entry.type === 'returned'));
});
