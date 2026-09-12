import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAudit } from './audit-helper.js';

test('recordAudit builds and persists an entry attributed to the requesting actor', async () => {
  const persisted = [];
  const store = {
    createAuditEntry: (fields) => ({ id: 'audit-1', createdAt: '2026-01-01T00:00:00.000Z', ...fields }),
    appendAuditEntry: async (entry) => { persisted.push(entry); return entry; },
  };
  const req = { user: { id: 'admin-1', role: 'Admin' } };

  const result = await recordAudit(store, req, { action: 'user.updated', entityType: 'user', entityId: 'u-2', details: { role: 'Supervisor' } });

  assert.equal(persisted.length, 1);
  assert.equal(result.actorId, 'admin-1');
  assert.equal(result.actorRole, 'Admin');
  assert.equal(result.action, 'user.updated');
  assert.deepEqual(result.details, { role: 'Supervisor' });
});

test('recordAudit is a no-op when the store has no audit capability, instead of throwing', async () => {
  const result = await recordAudit({}, { user: { id: 'admin-1' } }, { action: 'user.updated' });
  assert.equal(result, null);
});

test('recordAudit tolerates a missing actor rather than crashing the calling route', async () => {
  const store = {
    createAuditEntry: (fields) => fields,
    appendAuditEntry: async (entry) => entry,
  };
  const result = await recordAudit(store, {}, { action: 'system.startup' });
  assert.equal(result.actorId, '');
  assert.equal(result.actorRole, '');
});
