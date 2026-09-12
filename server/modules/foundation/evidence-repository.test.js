import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceRepository } from './evidence-repository.js';

const png = 'iVBORw0KGgo=';
const scanner = async () => ({ status: 'clean', scanner: 'test-scanner' });
function fixture() {
  const jsonDb = {};
  return { repository: createEvidenceRepository({ jsonDb, saveJson() {}, scanner }), jsonDb };
}

test('media is stored privately with hash, custody, scan, retention, and restricted access metadata', async () => {
  const { repository, jsonDb } = fixture();
  const refs = await repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { actorId: 'agent-1', allowedUserIds: ['supervisor-1'], retentionDays: 30 });
  assert.equal(refs.length, 1);
  assert.match(refs[0].hash, /^[a-f0-9]{64}$/);
  assert.equal(refs[0].storage, 'private-object-store');
  assert.equal(refs[0].malwareScan.status, 'clean');
  assert.equal(refs[0].malwareScan.scanner, 'test-scanner');
  assert.equal(refs[0].retention.days, 30);
  assert.equal(refs[0].custody[0].event, 'captured');
  const privateRecord = await repository.readPrivateEvidence(refs[0].id, { id: 'agent-1', role: 'Agent' });
  assert.equal(privateRecord.originalData, `data:image/png;base64,${png}`);
  await assert.rejects(repository.readPrivateEvidence(refs[0].id, { id: 'other-user', role: 'Agent' }), /not permitted/);
  assert.ok(Object.values(jsonDb.privateEvidence)[0].custody.some((event) => event.event === 'accessed'));
});

test('invalid media, unavailable scans, and oversized objects are quarantined or rejected', async () => {
  const { repository } = fixture();
  await assert.rejects(repository.protectMediaPayload([{ type: 'document', data: 'data:application/pdf;base64,aGVsbG8=' }]), /malformed or unsupported/);
  await assert.rejects(repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { scanner: async () => ({ status: 'unavailable', scanner: 'down' }) }), /quarantined/);
  await assert.rejects(repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { maxBytes: 1 }), /size limit/);
});

test('evidenceSummaries returns safe metadata only, never bytes, and ignores unknown ids', async () => {
  const { repository } = fixture();
  const [ref] = await repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { actorId: 'agent-1', retentionDays: 10 });
  const summaries = await repository.evidenceSummaries([ref.id, 'missing-id', ref.id]);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].id, ref.id);
  assert.equal(summaries[0].status, 'available');
  assert.equal(summaries[0].malwareScanStatus, 'clean');
  assert.equal('originalData' in summaries[0], false);
  assert.equal('access' in summaries[0], false);
});

test('sweepExpiredEvidence deletes only expired, non-held records and reports what it skipped', async () => {
  const { repository } = fixture();
  const [expired] = await repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { actorId: 'agent-1', retentionDays: 1 });
  const [onHold] = await repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { actorId: 'agent-1', retentionDays: 1 });
  const [notYetExpired] = await repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { actorId: 'agent-1', retentionDays: 3650 });
  await repository.setEvidenceLegalHold(onHold.id, { actor: { id: 'admin-1', role: 'Admin' }, reason: 'active dispute' });

  const future = new Date(Date.now() + 2 * 86400000).toISOString();
  const result = await repository.sweepExpiredEvidence({ now: future });

  assert.deepEqual(result.deleted, [expired.id]);
  assert.deepEqual(result.skippedLegalHold, [onHold.id]);
  assert.equal(result.evaluated, 2);
  assert.equal(await repository.readPrivateEvidence(expired.id, { id: 'agent-1', role: 'Agent' }), null);
  assert.ok(await repository.readPrivateEvidence(notYetExpired.id, { id: 'agent-1', role: 'Agent' }));
});

test('reassigned reviewers can be granted access and legal holds prevent deletion', async () => {
  const { repository } = fixture();
  const [ref] = await repository.protectMediaPayload([{ type: 'image', data: `data:image/png;base64,${png}` }], { actorId: 'agent-1' });
  await repository.grantEvidenceAccess(ref.id, { actorId: 'admin-1', userIds: ['reviewer-2'] });
  assert.equal((await repository.readPrivateEvidence(ref.id, { id: 'reviewer-2', role: 'Supervisor' })).id, ref.id);
  await repository.setEvidenceLegalHold(ref.id, { actor: { id: 'admin-1', role: 'Admin' }, reason: 'active review' });
  await assert.rejects(repository.deleteEvidence(ref.id, { id: 'admin-1', role: 'Admin' }), /not permitted/);
});
