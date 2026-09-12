import test from 'node:test';
import assert from 'node:assert/strict';
import { createTasksRepository } from './repository.js';
import { createNotificationsRepository } from '../notifications/repository.js';

function fixture() {
  const jsonDb = { tasks: {}, escalationHistory: {}, notifications: [], outbox: {} };
  const notifications = createNotificationsRepository({ jsonDb, saveJson() {}, mappers: {} });
  const tasks = createTasksRepository({ jsonDb, saveJson() {} });
  return { jsonDb, tasks, notifications };
}

test('tasks persist accountable ownership, acknowledgement, and evidence-gated completion', async () => {
  const { tasks } = fixture();
  const task = await tasks.createTask({ title: 'Restore polling unit network', accountableOwnerId: 'agent-1', incidentId: 'incident-1', deadlineAt: '2026-09-10T12:00:00.000Z', createdBy: 'supervisor-1' });
  await assert.rejects(tasks.completeTask(task.id, { actorId: 'agent-1', responseEvidence: [{ description: 'done' }] }), /meaningful response evidence/);
  const acknowledged = await tasks.acknowledgeTask(task.id, { actorId: 'agent-1' });
  assert.equal(acknowledged.status, 'acknowledged');
  const completed = await tasks.completeTask(task.id, { actorId: 'agent-1', responseEvidence: [{ id: 'evidence-1', type: 'image' }] });
  assert.equal(completed.status, 'completed');
});

test('overdue processing records escalation history and deduplicates notification outbox entries', async () => {
  const { tasks, notifications, jsonDb } = fixture();
  const task = await tasks.createTask({ title: 'Deliver replacement BVAS battery', accountableOwnerId: 'agent-1', resourceRequestId: 'resource-1', deadlineAt: '2026-09-10T10:00:00.000Z' });
  const first = await tasks.processOverdueTasks({ now: '2026-09-10T11:00:00.000Z', createNotification: notifications.createNotification });
  assert.equal(first[0].task.status, 'overdue');
  assert.equal(first[0].escalation.level, 1);
  assert.equal(Object.keys(jsonDb.outbox).length, 1);
  const second = await tasks.processOverdueTasks({ now: '2026-09-10T12:00:00.000Z', createNotification: notifications.createNotification });
  assert.equal(second.length, 0);
});

test('task acknowledgement retries are idempotent and conflicting payloads are explicit', async () => {
  const { tasks } = fixture();
  const task = await tasks.createTask({ title: 'Confirm field arrival', accountableOwnerId: 'agent-1', deadlineAt: '2026-09-10T12:00:00.000Z' });
  const first = await tasks.acknowledgeTask(task.id, { actorId: 'agent-1', sync: { submissionId: 'ack-1', payloadHash: 'hash-1', captureTime: '2026-09-11T10:00:00.000Z', serverReceiptTime: '2026-09-11T10:01:00.000Z', recordVersion: '1' } });
  assert.equal(first.acknowledgementSubmissionId, 'ack-1');
  const replay = await tasks.acknowledgeTask(task.id, { actorId: 'agent-1', sync: { submissionId: 'ack-1', payloadHash: 'hash-1', recordVersion: '1' } });
  assert.equal(replay.acknowledgementSubmissionId, 'ack-1');
  await assert.rejects(tasks.acknowledgeTask(task.id, { actorId: 'agent-1', sync: { submissionId: 'ack-1', payloadHash: 'different', recordVersion: '2' } }), (error) => error.code === 'SYNC_CONFLICT');
});