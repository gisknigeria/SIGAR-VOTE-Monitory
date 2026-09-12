import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationsRepository } from '../notifications/repository.js';
import { startTaskWorker } from './worker.js';

test('task worker delivers pending outbox entries and records retry state', async () => {
  const jsonDb = { notifications: [], outbox: {} };
  const notifications = createNotificationsRepository({ jsonDb, saveJson() {}, mappers: {} });
  await notifications.createNotification({ id: 'notification-1', userId: 'agent-1', message: 'Task assigned', createdAt: new Date().toISOString() });
  const delivered = [];
  const worker = startTaskWorker({ store: notifications, emitNotification: (payload) => delivered.push(payload), intervalMs: 60 * 60_000, logger: { error() {} } });
  const result = await worker.runOnce();
  worker.stop();
  assert.equal(result.delivered, 1);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].id, 'notification-1');
  assert.equal(Object.values(jsonDb.outbox)[0].status, 'delivered');
});

test('outbox delivery failures remain pending with retry metadata', async () => {
  const jsonDb = { notifications: [], outbox: {} };
  const notifications = createNotificationsRepository({ jsonDb, saveJson() {}, mappers: {} });
  await notifications.createNotification({ id: 'notification-2', userId: 'agent-1', message: 'Task assigned', createdAt: new Date().toISOString() });
  const worker = startTaskWorker({ store: notifications, emitNotification: () => { throw new Error('temporary delivery failure'); }, intervalMs: 60 * 60_000, logger: { error() {} } });
  const result = await worker.runOnce();
  worker.stop();
  assert.equal(result.delivered, 1);
  assert.equal(Object.values(jsonDb.outbox)[0].status, 'pending');
  assert.equal(Object.values(jsonDb.outbox)[0].attempts, 1);
  assert.match(Object.values(jsonDb.outbox)[0].lastError, /temporary delivery failure/);
});