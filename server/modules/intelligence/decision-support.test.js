import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntelligenceRepository } from './repository.js';

function fixture() {
  return createIntelligenceRepository({ jsonDb: {
    users: [{ id: 'ops-lead-1', active: true, role: 'Supervisor' }, { id: 'director-1', active: true, role: 'Admin' }, { id: 'supervisor-1', active: true, role: 'Supervisor' }],
    intelligenceSignals: { 'intelligence-signal:signal-1': { id: 'signal-1', sourceEventId: 'signal-1' } },
    incidents: [{ id: 'incident-1', reportType: 'Network Connectivity' }],
    tasks: { 'task:task-1': { id: 'task-1', accountableOwnerId: 'ops-lead-1' } },
    privateEvidence: { 'evidence:evidence-1': { id: 'evidence-1', status: 'available' }, 'evidence:action-1': { id: 'action-1', status: 'available' } },
  }, saveJson() {} });
}

test('decision records preserve accountable owner, source chain, explainable priority, and outcome', async () => {
  const repository = fixture();
  const decision = await repository.createDecision({
    ownerId: 'ops-lead-1',
    sourceIds: ['signal-1', 'incident-1'],
    data: { queueLength: 80 },
    signal: { type: 'situation', id: 'signal-1' },
    context: { lga: 'Ibadan North' },
    insight: 'Queue exceeds the operating threshold.',
    priority: 'high',
    priorityRationale: 'Queue length is above the deterministic threshold of 50.',
    alert: { channel: 'command-centre' },
    geography: { state: 'Oyo', lga: 'Ibadan North' },
    createdBy: 'analyst-1',
  });
  assert.equal(decision.stage, 'proposed');
  assert.equal(decision.autonomous, false);
  assert.equal(decision.accountableOwnerId, 'ops-lead-1');
  assert.deepEqual(decision.sourceIds, ['signal-1', 'incident-1']);
  await assert.rejects(repository.updateDecision(decision.id, { stage: 'assigned' }), /Human approval/);
  const approved = await repository.approveDecision(decision.id, { approvedBy: 'director-1' });
  const assigned = await repository.updateDecision(decision.id, { stage: 'assigned', assignment: { team: 'field', taskId: 'task-1' }, updatedBy: 'ops-lead-1' });
  const actioned = await repository.updateDecision(decision.id, { stage: 'actioned', action: { type: 'dispatch-resource', evidenceId: 'action-1' }, updatedBy: 'ops-lead-1' });
  const verifying = await repository.updateDecision(decision.id, { stage: 'verifying', verification: { verifiedBy: 'supervisor-1', evidenceId: 'evidence-1' }, updatedBy: 'supervisor-1' });
  const completed = await repository.updateDecision(decision.id, { stage: 'completed', outcome: { status: 'restored', note: 'Queue reduced.' }, updatedBy: 'supervisor-1' });
  assert.equal(approved.approvalStatus, 'approved');
  assert.equal(assigned.assignment.team, 'field');
  assert.equal(actioned.action.type, 'dispatch-resource');
  assert.equal(verifying.stage, 'verifying');
  assert.equal(completed.stage, 'completed');
  assert.equal(completed.outcome.status, 'restored');
});

test('decisions require an owner and source IDs', async () => {
  const repository = fixture();
  await assert.rejects(repository.createDecision({ ownerId: '', sourceIds: ['signal-1'], insight: 'x' }), /owner/);
  await assert.rejects(repository.createDecision({ ownerId: 'ops-lead-1', sourceIds: [], insight: 'x' }), /source ID/);
  await assert.rejects(repository.createDecision({ ownerId: 'ops-lead-1', sourceIds: ['signal-1'], priority: 'critical', insight: 'x' }), /priority rationale/);
  await assert.rejects(repository.createDecision({ ownerId: 'ops-lead-1', sourceIds: ['missing-source'], insight: 'x' }), /existing signal/);
});

test('material decision actions require legal transitions and linked evidence', async () => {
  const repository = fixture();
  const decision = await repository.createDecision({ ownerId: 'ops-lead-1', sourceIds: ['signal-1'], insight: 'Connectivity intervention', geography: { state: 'Oyo', lga: 'Ibadan North' } });
  await repository.approveDecision(decision.id, { approvedBy: 'director-1' });
  await assert.rejects(repository.updateDecision(decision.id, { stage: 'completed', outcome: { status: 'done' } }), /Illegal decision transition/);
  await repository.updateDecision(decision.id, { stage: 'assigned', assignment: { taskId: 'task-1' }, updatedBy: 'ops-lead-1' });
  await assert.rejects(repository.updateDecision(decision.id, { stage: 'actioned', action: { type: 'dispatch-resource' }, updatedBy: 'ops-lead-1' }), /linked evidence/);
});
