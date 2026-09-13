import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncidentsRepository } from './repository.js';
import { createStore } from '../../store.js';
import { canTransitionIncident, incidentTransitionPath } from './lifecycle.js';

function fixture() {
  const jsonDb = { incidents: [] };
  const repository = createIncidentsRepository({
    jsonDb,
    saveJson() {},
    mappers: { toIncident: (row) => row },
  });
  return { repository, jsonDb };
}

function incident() {
  return {
    id: 'incident-1',
    title: 'Connectivity failure',
    description: 'Polling unit is offline',
    reportType: 'Network Connectivity',
    severity: 'High',
    status: 'reported',
    lat: 7.4,
    lng: 3.9,
    assignedTo: 'agent-1',
    visibleTo: ['agent-1', 'supervisor-1'],
    media: [],
    createdAt: '2026-09-10T10:00:00.000Z',
    createdBy: 'agent-1',
  };
}

test('incident lifecycle records legal transitions, deadline, owner, and escalation history', async () => {
  const { repository } = fixture();
  await repository.createIncident(incident());
  const actor = { id: 'supervisor-1', role: 'Supervisor' };
  const transitions = [
    ['triaged', {}],
    ['assigned', { ownerId: 'agent-1', deadlineAt: '2026-09-10T12:00:00.000Z' }],
    ['acknowledged', {}],
    ['in progress', { escalationLevel: 1 }],
    ['verified', { verificationEvidence: [{ id: 'photo-1', type: 'image', source: 'field-evidence', hash: 'hash-1' }] }],
    ['resolved', {}],
    ['verified', { verificationEvidence: [{ id: 'photo-2', type: 'image', source: 'field-evidence', hash: 'hash-2' }] }],
    ['closed', {}],
  ];
  let current;
  for (const [status, options] of transitions) {
    current = await repository.transitionIncident('incident-1', status, { actor, ...options });
  }
  assert.equal(current.status, 'closed');
  assert.equal(current.lifecycle.ownerId, 'agent-1');
  assert.equal(current.lifecycle.deadlineAt, '2026-09-10T12:00:00.000Z');
  assert.equal(current.lifecycle.escalationLevel, 1);
  assert.equal(current.lifecycle.transitionHistory.length, 9);
  assert.equal(current.lifecycle.verifiedBy, 'supervisor-1');
});

test('a responder completing an assigned incident has a legal route to resolved', async () => {
  // The agent taps "Done" on an incident still sitting at `assigned`. The lifecycle forbids
  // jumping straight to resolved, so without a path the completion is rejected outright and the
  // admin is never told the work finished.
  assert.equal(canTransitionIncident('assigned', 'resolved'), false);
  assert.deepEqual(incidentTransitionPath('assigned', 'resolved'), ['acknowledged', 'in progress', 'resolved']);
  assert.deepEqual(incidentTransitionPath('reported', 'resolved'), ['triaged', 'assigned', 'acknowledged', 'in progress', 'resolved']);
  assert.deepEqual(incidentTransitionPath('Resolved', 'resolved'), [], 'same status needs no steps');
  assert.deepEqual(incidentTransitionPath('closed', 'resolved'), [], 'closed is terminal');

  // Walking that path must actually apply each step, leaving a complete history.
  const { repository } = fixture();
  await repository.createIncident({ ...incident(), status: 'assigned', assignedTo: 'agent-1' });
  const agent = { id: 'agent-1', role: 'Agent' };
  let current;
  for (const step of incidentTransitionPath('assigned', 'resolved')) {
    current = await repository.transitionIncident('incident-1', step, { actor: agent });
  }
  assert.equal(current.status, 'resolved');
  assert.deepEqual(current.lifecycle.transitionHistory.map((entry) => entry.to).slice(-3), ['acknowledged', 'in progress', 'resolved']);
});

test('resolved cannot be closed without a prior authorized verification transition', async () => {
  const { repository } = fixture();
  await repository.createIncident(incident());
  const agent = { id: 'agent-1', role: 'Agent' };
  const supervisor = { id: 'supervisor-1', role: 'Supervisor' };
  for (const status of ['triaged', 'assigned', 'acknowledged', 'in progress', 'resolved']) {
    await repository.transitionIncident('incident-1', status, { actor: agent });
  }
  await assert.rejects(
    repository.transitionIncident('incident-1', 'closed', { actor: agent }),
    /Illegal incident transition/,
  );
  await assert.rejects(
    repository.transitionIncident('incident-1', 'closed', {
      actor: supervisor,
      verificationEvidence: [{ id: 'ticket-1', type: 'ticket', source: 'supervisor-callback' }],
    }),
    /Illegal incident transition/,
  );
  const verified = await repository.transitionIncident('incident-1', 'verified', {
    actor: supervisor,
    verificationEvidence: [{ id: 'ticket-1', type: 'ticket', source: 'supervisor-callback' }],
  });
  const closed = await repository.transitionIncident('incident-1', 'closed', { actor: supervisor });
  assert.equal(verified.status, 'verified');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.lifecycle.verifiedBy, 'supervisor-1');
});

test('verification rejects unauthorized, non-independent, and text-only evidence', async () => {
  const { repository } = fixture();
  await repository.createIncident(incident());
  for (const status of ['triaged', 'assigned', 'acknowledged', 'in progress']) {
    await repository.transitionIncident('incident-1', status, { actor: { id: 'agent-1', role: 'Agent' } });
  }
  await assert.rejects(
    repository.transitionIncident('incident-1', 'verified', {
      actor: { id: 'agent-1', role: 'Agent' },
      verificationEvidence: [{ id: 'photo-1', type: 'image', source: 'field-evidence' }],
    }),
    /authorized reviewer|independent/,
  );
  await assert.rejects(
    repository.transitionIncident('incident-1', 'verified', {
      actor: { id: 'supervisor-1', role: 'Supervisor' },
      verificationEvidence: [{ id: 'note-1', description: 'Looks resolved' }],
    }),
    /Meaningful structured verification evidence/,
  );
});

test('illegal incident transitions are rejected', async () => {
  const { repository } = fixture();
  await repository.createIncident(incident());
  await assert.rejects(
    repository.transitionIncident('incident-1', 'closed', { actor: { id: 'supervisor-1', role: 'Supervisor' } }),
    /Illegal incident transition/,
  );
});

test('assignment-style transaction rolls back reassignment and notification after a transition failure', async () => {
  const jsonDb = {
    incidents: [incident()],
    notifications: [],
    users: [],
  };
  const store = createStore({ pool: null, jsonDb, saveJson() {}, mappers: {} });
  await assert.rejects(
    store.withTransaction(async (transactionStore) => {
      await transactionStore.updateIncident('incident-1', {
        assignedTo: 'agent-2',
        visibleTo: ['agent-2'],
        lifecycle: { ...jsonDb.incidents[0].lifecycle, ownerId: 'agent-2' },
      });
      await transactionStore.createNotification({
        id: 'notification-1',
        userId: 'agent-2',
        incidentId: 'incident-1',
        message: 'New assignment',
        createdAt: new Date().toISOString(),
      });
      await transactionStore.transitionIncident('incident-1', 'closed', { actor: { id: 'admin-1', role: 'Admin' } });
    }),
    /Illegal incident transition/,
  );
  assert.equal(jsonDb.incidents[0].assignedTo, 'agent-1');
  assert.deepEqual(jsonDb.incidents[0].visibleTo, ['agent-1', 'supervisor-1']);
  assert.equal(jsonDb.notifications.length, 0);
});
