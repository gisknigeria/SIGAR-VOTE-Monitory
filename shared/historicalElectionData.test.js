import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORICAL_ELECTION_DATASETS, HISTORICAL_ELECTION_RESULTS, getHistoricalDataset, historicalDatasetSummary } from './historicalElectionData.js';

test('every historical dataset has a corresponding result record', () => {
  for (const dataset of HISTORICAL_ELECTION_DATASETS) assert.ok(HISTORICAL_ELECTION_RESULTS[dataset.id], dataset.id);
});

test('historical helpers find Oyo datasets and summarize completeness', () => {
  assert.equal(getHistoricalDataset(2023, 'Governorship')?.id, '2023-governor');
  assert.equal(getHistoricalDataset(2022, 'Governorship'), null);
  assert.equal(historicalDatasetSummary().total, HISTORICAL_ELECTION_DATASETS.length);
});
