import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoundationRepository } from './repository.js';

function fixture() {
  const jsonDb = {};
  const repository = createFoundationRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });
  return { repository, jsonDb };
}

test('appendAuditEntry persists an entry and auditEvents lists it back, newest first', async () => {
  const { repository } = fixture();
  const first = repository.createAuditEntry({ actorId: 'admin-1', actorRole: 'Admin', action: 'identity.user_created', entityType: 'user', entityId: 'u-1' });
  await repository.appendAuditEntry(first);
  await new Promise((resolve) => setTimeout(resolve, 2));
  const second = repository.createAuditEntry({ actorId: 'admin-1', actorRole: 'Admin', action: 'identity.user_deleted', entityType: 'user', entityId: 'u-1' });
  await repository.appendAuditEntry(second);

  const page = await repository.auditEvents({});
  assert.equal(page.total, 2);
  assert.equal(page.items[0].action, 'identity.user_deleted');
  assert.equal(page.items[1].action, 'identity.user_created');
});

test('auditEvents filters by actor, entity, action and time window', async () => {
  const { repository } = fixture();
  await repository.appendAuditEntry(repository.createAuditEntry({ actorId: 'admin-1', action: 'evidence.accessed', entityType: 'evidence', entityId: 'ev-1' }));
  await repository.appendAuditEntry(repository.createAuditEntry({ actorId: 'admin-2', action: 'evidence.deleted', entityType: 'evidence', entityId: 'ev-2' }));

  assert.equal((await repository.auditEvents({ actorId: 'admin-2' })).total, 1);
  assert.equal((await repository.auditEvents({ entityId: 'ev-1' })).items[0].action, 'evidence.accessed');
  assert.equal((await repository.auditEvents({ action: 'evidence.deleted' })).total, 1);
  assert.equal((await repository.auditEvents({ since: new Date(Date.now() + 60_000).toISOString() })).total, 0, 'a since in the future must exclude everything, not include it');
});

test('auditEvents bounds its page size like every other cross-domain listing', async () => {
  const { repository } = fixture();
  for (let index = 0; index < 5; index += 1) {
    await repository.appendAuditEntry(repository.createAuditEntry({ actorId: 'admin-1', action: 'evidence.accessed', entityId: `ev-${index}` }));
  }
  const page = await repository.auditEvents({ limit: 2 });
  assert.equal(page.items.length, 2);
  assert.equal(page.total, 5);
});

test('no update or delete method is exposed for audit events at the application layer', () => {
  const { repository } = fixture();
  assert.equal(typeof repository.updateAuditEntry, 'undefined');
  assert.equal(typeof repository.deleteAuditEntry, 'undefined');
});
