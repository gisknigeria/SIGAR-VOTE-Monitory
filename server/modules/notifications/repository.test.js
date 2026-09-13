import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationsRepository } from './repository.js';

function fixture(pendingCount) {
  const jsonDb = { outbox: {} };
  for (let i = 0; i < pendingCount; i++) {
    const id = `outbox-${i}`;
    jsonDb.outbox[id] = { id, dedupeKey: id, notificationId: id, userId: 'user-1', status: 'pending', availableAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
  }
  return createNotificationsRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });
}

test('countPendingNotificationOutbox reports the true count, unlike the page-sized pendingNotificationOutbox', async () => {
  const repository = fixture(65);
  const page = await repository.pendingNotificationOutbox({ limit: 50 });
  assert.equal(page.length, 50);
  const total = await repository.countPendingNotificationOutbox();
  assert.equal(total, 65);
});

test('countPendingNotificationOutbox excludes delivered and not-yet-available entries', async () => {
  const repository = fixture(0);
  await repository.createNotification({ id: 'n1', userId: 'user-1', message: 'hi', createdAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(await repository.countPendingNotificationOutbox({ now: '2026-01-02T00:00:00.000Z' }), 1);
  await repository.markNotificationDelivered('outbox-n1');
  assert.equal(await repository.countPendingNotificationOutbox({ now: '2026-01-02T00:00:00.000Z' }), 0);
});
