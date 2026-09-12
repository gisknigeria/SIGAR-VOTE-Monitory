import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSyncEnvelope, SyncConflictError, syncConflictResponse } from './sync-contract.js';

test('sync envelope preserves client capture time and creates server receipt metadata', () => {
  const envelope = normalizeSyncEnvelope({ submissionId: 'device-1', captureTime: '2026-09-11T10:00:00.000Z', recordVersion: '3', payloadHash: 'hash-1' }, 'result');
  assert.equal(envelope.submissionId, 'device-1');
  assert.equal(envelope.captureTime, '2026-09-11T10:00:00.000Z');
  assert.equal(envelope.recordVersion, '3');
  assert.ok(envelope.serverReceiptTime);
});

test('sync conflicts expose explicit machine-readable resolution metadata', () => {
  const response = syncConflictResponse(new SyncConflictError({ submissionId: 'device-1', recordType: 'incident', existingVersion: '2', incomingVersion: '1', existingRecordId: 'incident-1' }));
  assert.equal(response.code, 'SYNC_CONFLICT');
  assert.equal(response.conflict.existingRecordId, 'incident-1');
  assert.equal(response.conflict.resolution, 'fetch-current-record-review-and-resubmit');
});
