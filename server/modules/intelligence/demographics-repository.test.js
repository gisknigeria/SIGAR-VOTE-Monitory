import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemographicsRepository } from './demographics-repository.js';

function fixture() { const jsonDb = {}; return { jsonDb, repository: createDemographicsRepository({ jsonDb, saveJson() {} }) }; }

const records = [{ geography: { state: 'Oyo', lga: 'Ibadan North' }, value: 1000, uncertainty: { lower: 900, upper: 1100 } }];

test('demographic datasets require source methodology and preserve publication and uncertainty metadata', async () => {
  const { repository } = fixture();
  const dataset = await repository.ingestDemographicDataset({ sourceId: 'source-pop', sourceName: 'Population publication', sourceVersion: '2025-v1', metric: 'population', resolution: 'lga', publicationDate: '2025-12-01', methodology: 'Census-derived aggregate table', records });
  assert.equal(dataset.status, 'pending-approval');
  assert.equal(dataset.publicationDate, '2025-12-01T00:00:00.000Z');
  assert.deepEqual(dataset.records[0].uncertainty, { lower: 900, upper: 1100 });
  await repository.approveDemographicDataset(dataset.id, { approvedBy: 'admin-1' });
  assert.equal((await repository.demographicDatasets({ metric: 'population' })).length, 1);
});

test('population and registered-voter analysis compares matching aggregate geography without inventing missing figures', async () => {
  const { repository } = fixture();
  const population = await repository.ingestDemographicDataset({ sourceId: 'source-pop', sourceName: 'Population', sourceVersion: 'v1', metric: 'population', resolution: 'lga', publicationDate: '2025-01-01', methodology: 'Aggregate estimate', records });
  const voters = await repository.ingestDemographicDataset({ sourceId: 'source-voters', sourceName: 'Registered voters', sourceVersion: 'v1', metric: 'registered-voters', resolution: 'lga', publicationDate: '2026-01-01', methodology: 'Published register aggregate', records: [{ geography: { state: 'Oyo', lga: 'Ibadan North' }, value: 400 }] });
  await repository.approveDemographicDataset(population.id, { approvedBy: 'admin-1' });
  await repository.approveDemographicDataset(voters.id, { approvedBy: 'admin-1' });
  const analysis = await repository.demographicAnalysis({ geography: { state: 'Oyo', lga: 'Ibadan North' }, populationDatasetId: population.id, registeredVotersDatasetId: voters.id });
  assert.equal(analysis.registeredVoterToPopulationRatio, 0.4);
  const unknown = await repository.demographicAnalysis({ geography: { state: 'Oyo', lga: 'Atiba' }, populationDatasetId: population.id, registeredVotersDatasetId: voters.id });
  assert.equal(unknown.estimateStatus, 'unknown');
  assert.equal(unknown.registeredVoterToPopulationRatio, null);
});

test('analysis with only a population dataset never throws and reports registered voters as unknown rather than inventing a ratio', async () => {
  const { repository } = fixture();
  const population = await repository.ingestDemographicDataset({ sourceId: 'source-pop', sourceName: 'Population', sourceVersion: 'v1', metric: 'population', resolution: 'lga', publicationDate: '2025-01-01', methodology: 'Aggregate estimate', records });
  await repository.approveDemographicDataset(population.id, { approvedBy: 'admin-1' });
  const analysis = await repository.demographicAnalysis({ geography: { state: 'Oyo', lga: 'Ibadan North' }, populationDatasetId: population.id });
  assert.equal(analysis.population.value, 1000);
  assert.equal(analysis.registeredVoters, null);
  assert.equal(analysis.registeredVoterToPopulationRatio, null);
  assert.equal(analysis.estimateStatus, 'unknown');
});

test('individual voter fields are rejected', async () => {
  const { repository } = fixture();
  await assert.rejects(repository.ingestDemographicDataset({ sourceId: 'bad', sourceName: 'Bad', sourceVersion: 'v1', metric: 'registered-voters', resolution: 'lga', publicationDate: '2026-01-01', methodology: 'unknown', records: [{ geography: { state: 'Oyo' }, voterId: 'person-1', value: 1 }] }), /personal field/);
});
