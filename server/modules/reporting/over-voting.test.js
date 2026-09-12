import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOverVotingCheck, pickCanonicalRecordsByPollingUnit } from './over-voting.js';

const record = (overrides = {}) => ({
  lga: 'IBADAN NORTH', ward: 'BASHORUN', pollingUnit: 'UI PRIMARY SCHOOL',
  resultSource: 'Agent', createdAt: '2026-01-01T00:00:00.000Z',
  resultCount: JSON.stringify([{ party: 'APC', votes: 100 }, { party: 'PDP', votes: 50 }]),
  ...overrides,
});

test('pickCanonicalRecordsByPollingUnit keeps one record per unit, preferring higher-authority source', () => {
  const agent = record({ resultSource: 'Agent' });
  const supervisor = record({ resultSource: 'Supervisor', resultCount: JSON.stringify([{ party: 'APC', votes: 90 }]) });
  const canonical = pickCanonicalRecordsByPollingUnit([agent, supervisor]);
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].resultSource, 'Supervisor');
});

test('pickCanonicalRecordsByPollingUnit breaks ties by most recent submission', () => {
  const older = record({ resultSource: 'Agent', createdAt: '2026-01-01T00:00:00.000Z' });
  const newer = record({ resultSource: 'Agent', createdAt: '2026-01-02T00:00:00.000Z', resultCount: JSON.stringify([{ party: 'APC', votes: 5 }]) });
  const canonical = pickCanonicalRecordsByPollingUnit([older, newer]);
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].createdAt, '2026-01-02T00:00:00.000Z');
});

test('pickCanonicalRecordsByPollingUnit treats different polling units independently', () => {
  const unitA = record({ pollingUnit: 'UNIT A' });
  const unitB = record({ pollingUnit: 'UNIT B' });
  assert.equal(pickCanonicalRecordsByPollingUnit([unitA, unitB]).length, 2);
});

test('computeOverVotingCheck sums deduplicated votes, not raw record count, across multiple sources for the same unit', () => {
  const agent = record({ resultSource: 'Agent', resultCount: JSON.stringify([{ party: 'APC', votes: 300 }]) });
  const supervisor = record({ resultSource: 'Supervisor', resultCount: JSON.stringify([{ party: 'APC', votes: 300 }]) });
  const votersDatasets = [{ id: 'v1', sourceName: 'INEC', sourceVersion: '2023', publicationDate: '2023-01-01', records: [{ geography: { state: 'Oyo', lga: '', ward: '', pollingUnit: '' }, value: 3276675 }] }];
  const result = computeOverVotingCheck({ geography: { state: 'Oyo' }, resultRecords: [agent, supervisor], votersDatasets });
  // Must be 300 (one canonical record), never 600 (both summed).
  assert.equal(result.submittedVotes, 300);
  assert.equal(result.status, 'within-bounds');
});

test('computeOverVotingCheck flags when deduplicated submitted votes exceed the exact-geography registered-voter figure', () => {
  const records = [record({ resultCount: JSON.stringify([{ party: 'APC', votes: 4000000 }]) })];
  const votersDatasets = [{ id: 'v1', sourceName: 'INEC', sourceVersion: '2023', publicationDate: '2023-01-01', records: [{ geography: { state: 'Oyo', lga: '', ward: '', pollingUnit: '' }, value: 3276675 }] }];
  const result = computeOverVotingCheck({ geography: { state: 'Oyo' }, resultRecords: records, votersDatasets });
  assert.equal(result.status, 'exceeds-registered-voters');
  assert.equal(result.excessVotes, 4000000 - 3276675);
});

test('computeOverVotingCheck returns unknown, never a borrowed broader figure, when no exact-geography voters record exists', () => {
  const records = [record()];
  const votersDatasets = [{ id: 'v1', sourceName: 'INEC', sourceVersion: '2023', publicationDate: '2023-01-01', records: [{ geography: { state: 'Oyo', lga: '', ward: '', pollingUnit: '' }, value: 3276675 }] }];
  // Scoping to a specific LGA, for which only the state-wide figure exists.
  const result = computeOverVotingCheck({ geography: { state: 'Oyo', lga: 'IBADAN NORTH' }, resultRecords: records, votersDatasets });
  assert.equal(result.status, 'unknown');
  assert.equal(result.registeredVoters, null);
});
