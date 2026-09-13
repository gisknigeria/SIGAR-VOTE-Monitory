import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraRecordingsRepository } from './camera-recordings.js';

function fixture() {
  const jsonDb = {};
  return createCameraRecordingsRepository({ pool: null, jsonDb, saveJson() {} });
}

const actor = { id: 'u1', role: 'Agent', name: 'Test Agent', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 001' };
const evidenceRef = { id: 'ev-1', mimeType: 'video/webm', byteLength: 12345 };

test('retried segments keep one index entry per actor and retain capture location and time', async () => {
  const repository = fixture();
  const input = { actor, evidenceRef, segmentId: 'offline-segment-1', startedAt: '2026-09-13T09:00:00Z', endedAt: '2026-09-13T09:00:45Z', location: { lat: 7.4, lng: 3.9 }, geography: { lga: actor.lga, ward: actor.ward } };
  const first = await repository.saveCameraRecording(input);
  const retry = await repository.saveCameraRecording(input);
  assert.equal(first.id, retry.id);
  assert.equal((await repository.cameraRecordings()).length, 1);
  assert.deepEqual(retry.location, input.location);
  assert.equal(retry.endedAt, input.endedAt);
  await repository.saveCameraRecording({ ...input, actor: { ...actor, id: 'another-agent' } });
  assert.equal((await repository.cameraRecordings()).length, 2);
});

test('saveCameraRecording requires an authenticated actor and a protected evidence reference', async () => {
  const repository = fixture();
  await assert.rejects(() => repository.saveCameraRecording({ actor: null, evidenceRef }), /authenticated actor/);
  await assert.rejects(() => repository.saveCameraRecording({ actor, evidenceRef: null }), /protected evidence reference/);
});

test('saveCameraRecording indexes the recording by the geography supplied, defaulting state to Oyo', async () => {
  const repository = fixture();
  const record = await repository.saveCameraRecording({ actor, evidenceRef, startedAt: '2026-01-01T00:00:00.000Z', geography: { lga: actor.lga, ward: actor.ward, pollingUnit: actor.pollingUnit } });
  assert.equal(record.evidenceId, 'ev-1');
  assert.equal(record.submittedBy, 'u1');
  assert.equal(record.submittedByRole, 'Agent');
  assert.deepEqual(record.geography, { state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 001', station: '' });
  assert.equal(record.mimeType, 'video/webm');
  assert.equal(record.byteLength, 12345);
  assert.ok(record.endedAt);
});

test('cameraRecordings filters by geography and returns newest first', async () => {
  const repository = fixture();
  await repository.saveCameraRecording({ actor, evidenceRef, geography: { lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 001' } });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await repository.saveCameraRecording({ actor: { ...actor, id: 'u2' }, evidenceRef, geography: { lga: 'Ibadan North', ward: 'Ward 2', pollingUnit: 'PU 002' } });
  await repository.saveCameraRecording({ actor: { ...actor, id: 'u3' }, evidenceRef, geography: { lga: 'Iseyin', ward: 'Ward 1', pollingUnit: 'PU 001' } });

  const ibadanNorth = await repository.cameraRecordings({ lga: 'Ibadan North' });
  assert.equal(ibadanNorth.length, 2);
  assert.ok(new Date(ibadanNorth[0].createdAt) >= new Date(ibadanNorth[1].createdAt));

  const wardTwo = await repository.cameraRecordings({ lga: 'Ibadan North', ward: 'Ward 2' });
  assert.equal(wardTwo.length, 1);
  assert.equal(wardTwo[0].submittedBy, 'u2');

  const all = await repository.cameraRecordings();
  assert.equal(all.length, 3);
});
