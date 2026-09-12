import test from 'node:test';
import assert from 'node:assert/strict';
import { createReconciliationRepository } from './reconciliation-repository.js';

function fixture() {
  const jsonDb = {
    resultRecords: [
      { id: 'agent-result', electionId: 'election-1', contestId: 'contest-1', sourceReleaseId: 'source-v1', pollingUnit: 'PU 1', resultCount: JSON.stringify([{ party: 'APC', votes: 10 }, { party: 'PDP', votes: null }]), submittedBy: 'agent-1' },
      { id: 'supervisor-result', electionId: 'election-1', contestId: 'contest-1', sourceReleaseId: 'source-v1', pollingUnit: 'PU 1', resultCount: JSON.stringify([{ party: 'APC', votes: 12 }, { party: 'PDP', votes: null }]), submittedBy: 'supervisor-1' },
    ],
  };
  return { jsonDb, repository: createReconciliationRepository({ pool: null, jsonDb, saveJson() {} }) };
}

const official = {
  electionId: 'election-1', contestId: 'contest-1', sourceVersion: 'source-v1', pollingUnit: 'PU 1',
  sourceType: 'official-publication', resultCount: [{ party: 'APC', votes: 12 }, { party: 'PDP', votes: null }],
};

test('reconciliation compares matching election, contest, polling unit, and source version only', async () => {
  const { repository } = fixture();
  const item = await repository.reconcileResults({ resultRecordIds: ['agent-result', 'supervisor-result'], officialRecord: official, sourceClassification: 'authoritative-master', sourceReleaseId: 'release-official-v1' });
  assert.equal(item.status, 'pending-review');
  assert.equal(item.discrepancies.length, 1);
  assert.equal(item.discrepancies[0].reason, 'vote-count-mismatch');
  await assert.rejects(repository.reconcileResults({ resultRecordIds: ['agent-result'], officialRecord: { ...official, sourceVersion: 'source-v2' }, sourceClassification: 'authoritative-master', sourceReleaseId: 'release-official-v1' }), /matching election/);
});

test('OCR requires source evidence and corrections never overwrite originals', async () => {
  const { repository, jsonDb } = fixture();
  await assert.rejects(repository.reconcileResults({ resultRecordIds: ['agent-result'], officialRecord: { ...official, sourceType: 'ocr' }, sourceClassification: 'authoritative-master', sourceReleaseId: 'release-official-v1' }), /source evidence/);
  const item = await repository.reconcileResults({ resultRecordIds: ['agent-result'], officialRecord: { ...official, sourceType: 'ocr', derivedFromEvidenceId: 'evidence-1' }, sourceClassification: 'authoritative-master', sourceReleaseId: 'release-official-v1' });
  await assert.rejects(repository.reviewReconciliation(item.id, { reviewerId: 'agent-1', decision: 'correct', reason: 'not independent', correctedResult: { APC: 11 } }), /independent/);
  const reviewed = await repository.reviewReconciliation(item.id, { reviewerId: 'reviewer-1', decision: 'correct', reason: 'Supervisor form reviewed', correctedResult: [{ party: 'APC', votes: 11 }] });
  assert.equal(reviewed.status, 'reviewed');
  assert.equal((await repository.resultCorrections(item.id)).length, 1);
  assert.equal(JSON.parse(jsonDb.resultRecords[0].resultCount)[0].votes, 10);
});
