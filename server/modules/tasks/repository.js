import { randomUUID } from 'node:crypto';
import { SyncConflictError } from '../foundation/sync-contract.js';

const TASK_STATUSES = ['open', 'acknowledged', 'in-progress', 'completed', 'cancelled', 'overdue'];
const PRIORITIES = ['low', 'normal', 'high', 'critical'];

const validEvidence = (evidence) => Array.isArray(evidence) && evidence.some((item) => {
  if (!item || typeof item !== 'object') return false;
  return Boolean(String(item.id || item.hash || item.referenceId || '').trim() && String(item.type || item.kind || '').trim());
});

export function createTasksRepository({ pool, jsonDb, saveJson }) {
  const taskKey = (id) => `task:${id}`;
  const escalationKey = (id) => `escalation:${id}`;
  const readTasks = async () => {
    if (!pool) {
      jsonDb.tasks ||= {};
      return Object.values(jsonDb.tasks);
    }
    return (await pool.query('select * from tasks order by created_at desc')).rows.map((row) => ({
      ...row,
      accountableOwnerId: row.accountable_owner_id,
      incidentId: row.incident_id,
      decisionId: row.decision_id,
      resourceRequestId: row.resource_request_id,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
      acknowledgementSubmissionId: row.acknowledgement_submission_id || '',
      acknowledgementCaptureTime: row.acknowledgement_capture_time,
      acknowledgementServerReceiptAt: row.acknowledgement_server_receipt_at,
      acknowledgementRecordVersion: row.acknowledgement_record_version || '1',
      acknowledgementPayloadHash: row.acknowledgement_payload_hash || '',
      deadlineAt: row.deadline_at,
      responseEvidence: row.response_evidence || [],
      escalationLevel: row.escalation_level || 0,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  };
  const saveTask = async (task) => {
    if (!pool) {
      jsonDb.tasks ||= {};
      jsonDb.tasks[taskKey(task.id)] = task;
      saveJson();
      return task;
    }
    await pool.query(`insert into tasks (id,title,description,status,priority,accountable_owner_id,incident_id,decision_id,resource_request_id,geography,acknowledged_at,acknowledged_by,acknowledgement_submission_id,acknowledgement_capture_time,acknowledgement_server_receipt_at,acknowledgement_record_version,acknowledgement_payload_hash,deadline_at,response_evidence,escalation_level,created_by,created_at,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      on conflict (id) do update set title=excluded.title,description=excluded.description,status=excluded.status,priority=excluded.priority,accountable_owner_id=excluded.accountable_owner_id,incident_id=excluded.incident_id,decision_id=excluded.decision_id,resource_request_id=excluded.resource_request_id,geography=excluded.geography,acknowledged_at=excluded.acknowledged_at,acknowledged_by=excluded.acknowledged_by,acknowledgement_submission_id=excluded.acknowledgement_submission_id,acknowledgement_capture_time=excluded.acknowledgement_capture_time,acknowledgement_server_receipt_at=excluded.acknowledgement_server_receipt_at,acknowledgement_record_version=excluded.acknowledgement_record_version,acknowledgement_payload_hash=excluded.acknowledgement_payload_hash,deadline_at=excluded.deadline_at,response_evidence=excluded.response_evidence,escalation_level=excluded.escalation_level,updated_at=excluded.updated_at`, [task.id, task.title, task.description, task.status, task.priority, task.accountableOwnerId, task.incidentId, task.decisionId, task.resourceRequestId, JSON.stringify(task.geography || {}), task.acknowledgedAt, task.acknowledgedBy, task.acknowledgementSubmissionId || '', task.acknowledgementCaptureTime || null, task.acknowledgementServerReceiptAt || null, task.acknowledgementRecordVersion || '1', task.acknowledgementPayloadHash || '', task.deadlineAt, JSON.stringify(task.responseEvidence || []), task.escalationLevel, task.createdBy, task.createdAt, task.updatedAt]);
    return task;
  };
  const saveEscalation = async (entry) => {
    if (!pool) {
      jsonDb.escalationHistory ||= {};
      jsonDb.escalationHistory[escalationKey(entry.id)] = entry;
      saveJson();
      return entry;
    }
    await pool.query('insert into escalation_history (id,task_id,incident_id,level,reason,actor_id,created_at) values ($1,$2,$3,$4,$5,$6,$7)', [entry.id, entry.taskId, entry.incidentId, entry.level, entry.reason, entry.actorId, entry.createdAt]);
    return entry;
  };
  return {
    async tasks({ ownerId, incidentId, decisionId, status } = {}) {
      return (await readTasks()).filter((task) => (!ownerId || task.accountableOwnerId === ownerId) && (!incidentId || task.incidentId === incidentId) && (!decisionId || task.decisionId === decisionId) && (!status || task.status === status));
    },
    async createTask({ title, description = '', priority = 'normal', accountableOwnerId, incidentId = '', decisionId = '', resourceRequestId = '', geography = {}, deadlineAt = null, createdBy = '' }) {
      const owner = String(accountableOwnerId || '').trim();
      if (!String(title || '').trim() || !owner) throw new Error('A task title and accountable owner are required.');
      if (!PRIORITIES.includes(priority)) throw new Error('Invalid task priority.');
      if (!deadlineAt || !Number.isFinite(new Date(deadlineAt).getTime())) throw new Error('A valid task deadline is required.');
      const now = new Date().toISOString();
      return saveTask({ id: randomUUID(), title: String(title).trim(), description: String(description || '').trim(), status: 'open', priority, accountableOwnerId: owner, incidentId: String(incidentId || ''), decisionId: String(decisionId || ''), resourceRequestId: String(resourceRequestId || ''), geography, acknowledgedAt: null, acknowledgedBy: '', deadlineAt: new Date(deadlineAt).toISOString(), responseEvidence: [], escalationLevel: 0, createdBy: String(createdBy || ''), createdAt: now, updatedAt: now });
    },
    async acknowledgeTask(id, { actorId = '', sync = {} } = {}) {
      const task = (await readTasks()).find((item) => item.id === id);
      if (!task) return null;
      if (String(actorId) !== task.accountableOwnerId) throw new Error('Only the accountable owner may acknowledge this task.');
      if (sync.submissionId && task.acknowledgementSubmissionId) {
        if (sync.submissionId === task.acknowledgementSubmissionId && sync.payloadHash === task.acknowledgementPayloadHash) return task;
        throw new SyncConflictError({ submissionId: sync.submissionId, recordType: 'task-ack', existingVersion: task.acknowledgementRecordVersion, incomingVersion: sync.recordVersion, existingRecordId: task.id });
      }
      const now = new Date().toISOString();
      return saveTask({ ...task, status: 'acknowledged', acknowledgedAt: now, acknowledgedBy: actorId, acknowledgementSubmissionId: sync.submissionId || '', acknowledgementCaptureTime: sync.captureTime || now, acknowledgementServerReceiptAt: sync.serverReceiptTime || now, acknowledgementRecordVersion: sync.recordVersion || '1', acknowledgementPayloadHash: sync.payloadHash || '', updatedAt: now });
    },
    async completeTask(id, { actorId = '', responseEvidence = [] } = {}) {
      const task = (await readTasks()).find((item) => item.id === id);
      if (!task) return null;
      if (String(actorId) !== task.accountableOwnerId) throw new Error('Only the accountable owner may complete this task.');
      if (!validEvidence(responseEvidence)) throw new Error('meaningful response evidence is required to complete a task.');
      return saveTask({ ...task, status: 'completed', responseEvidence, updatedAt: new Date().toISOString() });
    },
    async processOverdueTasks({ now = new Date().toISOString(), createNotification } = {}) {
      const overdue = (await readTasks()).filter((task) => ['open', 'acknowledged', 'in-progress'].includes(task.status) && task.deadlineAt && new Date(task.deadlineAt).getTime() <= new Date(now).getTime());
      const results = [];
      for (const task of overdue) {
        const level = Number(task.escalationLevel || 0) + 1;
        const updated = await saveTask({ ...task, status: 'overdue', escalationLevel: level, updatedAt: now });
        const history = await saveEscalation({ id: randomUUID(), taskId: task.id, incidentId: task.incidentId, level, reason: 'task deadline exceeded', actorId: 'system', createdAt: now });
        let notification = null;
        if (createNotification) notification = await createNotification({ id: randomUUID(), userId: task.accountableOwnerId, incidentId: task.incidentId, message: `Task overdue: ${task.title}`, incidentType: 'Task escalation', dedupeKey: `task-overdue:${task.id}:${level}`, createdAt: now });
        results.push({ task: updated, escalation: history, notification });
      }
      return results;
    },
  };
}