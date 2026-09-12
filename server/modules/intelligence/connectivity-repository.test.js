import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectivityRepository } from './connectivity-repository.js';

function fixture() { const jsonDb = {}; return { jsonDb, repository: createConnectivityRepository({ jsonDb, saveJson() {} }) }; }

test('connectivity datasets preserve measured versus estimated observations and authorized base stations', async () => {
  const { repository } = fixture();
  const dataset = await repository.ingestConnectivityDataset({ sourceId: 'coverage-source', sourceName: 'Supplied coverage table', sourceVersion: '2026-v1', resolution: 'lga', methodology: 'Provider-published aggregate coverage', records: [{ geography: { state: 'Oyo', lga: 'Ibadan North' }, provider: 'Provider A', technologies: ['4G'], observationType: 'measured', measuredAt: '2026-09-01T00:00:00Z', baseStation: { id: 'station-1', latitude: 7.4, longitude: 3.9, authorized: true }, redundancy: { providers: ['Provider A', 'Provider B'] } }] });
  assert.equal(dataset.status, 'pending-approval');
  await repository.approveConnectivityDataset(dataset.id, { approvedBy: 'admin-1' });
  const analysis = await repository.connectivityAnalysis({ geography: { state: 'Oyo', lga: 'Ibadan North' } });
  assert.equal(analysis.measuredCount, 1);
  assert.equal(analysis.estimatedCount, 0);
  assert.equal(analysis.baseStations[0].id, 'station-1');
  assert.equal(analysis.redundancy.available, true);
});

test('connectivity analysis preserves uncertainty and states offline planning limits when only estimates exist', async () => {
  const { repository } = fixture();
  const dataset = await repository.ingestConnectivityDataset({ sourceId: 'estimated-source', sourceName: 'Supplied estimated coverage', sourceVersion: 'v1', resolution: 'ward', methodology: 'Modelled estimate', records: [{ geography: { state: 'Oyo', lga: 'Atiba', ward: 'Ward 1' }, provider: 'Provider A', technologies: ['LTE'], observationType: 'estimated' }] });
  await repository.approveConnectivityDataset(dataset.id, { approvedBy: 'admin-1' });
  const analysis = await repository.connectivityAnalysis({ geography: { state: 'Oyo', lga: 'Atiba', ward: 'Ward 1' } });
  assert.equal(analysis.planning.liveCoverageStatus, 'estimated-only');
  assert.ok(analysis.planning.offlineRequirements.length > 0);
  assert.equal(analysis.redundancy.available, false);
});

test('connectivity does not invent data from empty sources', async () => {
  const { repository } = fixture();
  const analysis = await repository.connectivityAnalysis({ geography: { state: 'Oyo', lga: 'Unknown' } });
  assert.equal(analysis.planning.liveCoverageStatus, 'unknown');
  assert.deepEqual(analysis.records, []);
});
