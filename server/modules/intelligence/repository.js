import { randomUUID } from 'node:crypto';
import { SyncConflictError } from '../foundation/sync-contract.js';
import { AUTHORIZED_SIGNAL_REVIEWERS, normalizeSignalCategory, normalizeSignalConfidence, SIGNAL_CATEGORIES } from './signal-taxonomy.js';

export const SIGNAL_TYPES = ['pulse', 'situation', 'sentiment', 'incident', 'action'];
export const SIGNAL_VERIFICATION = ['unverified', 'provisional', 'verified', 'rejected'];

const normalizeViews = (views) => [...new Set((Array.isArray(views) ? views : []).map((value) => String(value || '').trim().toLowerCase()).filter((value) => SIGNAL_TYPES.includes(value)))];
const DECISION_STAGES = ['proposed', 'approved', 'assigned', 'actioned', 'verifying', 'completed', 'rejected'];
const LEGAL_TRANSITIONS = new Map([
  ['proposed', new Set(['approved', 'rejected'])],
  ['approved', new Set(['assigned', 'rejected'])],
  ['assigned', new Set(['actioned', 'rejected'])],
  ['actioned', new Set(['verifying', 'rejected'])],
  ['verifying', new Set(['completed', 'actioned', 'rejected'])],
  ['completed', new Set()],
  ['rejected', new Set()],
]);

export function createIntelligenceRepository({ pool, jsonDb, saveJson }) {
  const key = (sourceEventId) => `intelligence-signal:${sourceEventId}`;
  const decisionKey = (id) => `intelligence-decision:${id}`;
  const read = async () => {
    if (!pool) {
      jsonDb.intelligenceSignals ||= {};
      return Object.values(jsonDb.intelligenceSignals);
    }
    return (await pool.query("select value from app_settings where key like 'intelligence-signal:%'")).rows.map((row) => row.value);
  };
  const save = async (signal) => {
    if (!pool) {
      jsonDb.intelligenceSignals ||= {};
      jsonDb.intelligenceSignals[key(signal.sourceEventId)] = signal;
      saveJson();
      return signal;
    }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key(signal.sourceEventId), JSON.stringify(signal)]);
    return signal;
  };
  const readDecisions = async () => {
    if (!pool) {
      jsonDb.intelligenceDecisions ||= {};
      return Object.values(jsonDb.intelligenceDecisions);
    }
    return (await pool.query("select value from app_settings where key like 'intelligence-decision:%'")).rows.map((row) => row.value);
  };
  const saveDecision = async (decision) => {
    if (!pool) {
      jsonDb.intelligenceDecisions ||= {};
      jsonDb.intelligenceDecisions[decisionKey(decision.id)] = decision;
      saveJson();
      return decision;
    }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [decisionKey(decision.id), JSON.stringify(decision)]);
    return decision;
  };
  const readOwners = async () => {
    if (!pool) return jsonDb.users || [];
    return (await pool.query('select id, role, active, state, lga, ward from users')).rows;
  };
  const readSourceRecords = async () => {
    if (!pool) return { signals: Object.values(jsonDb.intelligenceSignals || {}), incidents: jsonDb.incidents || [], tasks: Object.values(jsonDb.tasks || {}), resources: Object.values(jsonDb.resourceIntelligence || {}) };
    const [incidents, settings] = await Promise.all([pool.query('select id, lga, ward, polling_unit, status from incidents'), pool.query("select key,value from app_settings where key like 'intelligence-signal:%' or key like 'task:%' or key like 'resource-intelligence:%'")]);
    const result = { signals: [], incidents: incidents.rows, tasks: [], resources: [] };
    for (const row of settings.rows) {
      if (row.key.startsWith('intelligence-signal:')) result.signals.push(row.value);
      if (row.key.startsWith('task:')) result.tasks.push(row.value);
      if (row.key.startsWith('resource-intelligence:')) result.resources.push(row.value);
    }
    return result;
  };
  const resolveSources = async (sourceIds) => {
    const sourceRecords = await readSourceRecords();
    return sourceIds.map((sourceId) => {
      const id = String(sourceId).trim();
      return sourceRecords.signals.find((item) => item.id === id || item.sourceEventId === id) ||
        sourceRecords.incidents.find((item) => item.id === id) ||
        sourceRecords.tasks.find((item) => item.id === id) ||
        sourceRecords.resources.find((item) => item.id === id) || null;
    });
  };
  return {
    async createIntelligenceSignal({ sourceEventId, views, signalType, category, title, description = '', geography = {}, source = {}, verificationStatus = 'unverified', isRumour = false, recordedBy = '', sync = {}, confidence = 'unknown', observedAt = '', freshnessExpiresAt = '', duplicateOf = '' }) {
      const id = String(sourceEventId || '').trim();
      const normalizedViews = normalizeViews(views?.length ? views : [signalType]);
      if (!id || !normalizedViews.length || !title) throw new Error('sourceEventId, at least one valid view, and title are required.');
      if (isRumour) { verificationStatus = 'unverified'; category = 'rumour'; }
      if (!SIGNAL_VERIFICATION.includes(verificationStatus)) throw new Error('Invalid signal verification status.');
      const existing = (await read()).find((signal) => signal.sourceEventId === id);
      if (existing && sync.submissionId && existing.submissionId === sync.submissionId && existing.payloadHash === sync.payloadHash) return existing;
      if (existing && sync.submissionId && existing.submissionId === sync.submissionId) throw new SyncConflictError({ submissionId: sync.submissionId, recordType: 'observation', existingVersion: existing.recordVersion, incomingVersion: sync.recordVersion, existingRecordId: existing.id });
      const now = new Date().toISOString();
      if (existing) {
        return save({ ...existing, views: normalizeViews([...(existing.views || []), ...normalizedViews]), updatedAt: now });
      }
      const normalizedCategory = normalizeSignalCategory(category || (isRumour ? 'rumour' : signalType));
      const normalizedObservedAt = observedAt && Number.isFinite(Date.parse(observedAt)) ? new Date(observedAt).toISOString() : now;
      const normalizedExpiry = freshnessExpiresAt && Number.isFinite(Date.parse(freshnessExpiresAt)) ? new Date(freshnessExpiresAt).toISOString() : null;
      return save({
        id: randomUUID(),
        sourceEventId: id,
        views: normalizedViews,
        signalType: normalizedViews[0],
        category: normalizedCategory,
        title: String(title).trim().slice(0, 240),
        description: String(description || '').trim().slice(0, 4000),
        geography,
        source,
        verificationStatus,
        confidence: normalizeSignalConfidence(confidence),
        observedAt: normalizedObservedAt,
        freshnessExpiresAt: normalizedExpiry,
        isFresh: normalizedExpiry ? new Date(normalizedExpiry).getTime() >= Date.now() : null,
        duplicateOf: String(duplicateOf || '').trim(),
        isRumour: Boolean(isRumour),
        label: isRumour || verificationStatus === 'unverified' ? 'UNVERIFIED' : verificationStatus.toUpperCase(),
        recordedBy,
        submissionId: sync.submissionId || '',
        captureTime: sync.captureTime || now,
        serverReceiptTime: sync.serverReceiptTime || now,
        recordVersion: sync.recordVersion || '1',
        payloadHash: sync.payloadHash || '',
        createdAt: now,
        updatedAt: now,
      });
    },
    async verifyIntelligenceSignal(id, { reviewerId = '', reviewerRole = '', verificationStatus = 'verified', confidence = 'high', reviewNote = '' } = {}) {
      const signals = await read();
      const signal = signals.find((item) => item.id === id);
      if (!signal) return null;
      if (!reviewerId || !AUTHORIZED_SIGNAL_REVIEWERS.includes(reviewerRole)) throw new Error('An authorized reviewer is required to verify a signal.');
      if (!['verified', 'rejected', 'provisional'].includes(verificationStatus)) throw new Error('Invalid signal verification status.');
      return save({ ...signal, verificationStatus, confidence: normalizeSignalConfidence(confidence), review: { reviewerId, reviewerRole, reviewNote: String(reviewNote || '').trim(), reviewedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() });
    },
    async intelligenceSignals({ view, sourceEventId, geography = {} } = {}) {
      const signals = await read();
      return signals.filter((signal) =>
        (!view || signal.views.includes(String(view).toLowerCase())) &&
        (!sourceEventId || signal.sourceEventId === sourceEventId) &&
        Object.entries(geography).every(([key, value]) => !value || signal.geography?.[key] === value),
      );
    },
    async intelligenceViewSummary({ view, geography = {} } = {}) {
      const signals = await this.intelligenceSignals({ view, geography });
      const unique = [...new Map(signals.map((signal) => [signal.sourceEventId, signal])).values()];
      return {
        view: view ? String(view).toLowerCase() : 'all',
        count: unique.length,
        verified: unique.filter((signal) => signal.verificationStatus === 'verified').length,
        unverified: unique.filter((signal) => signal.verificationStatus === 'unverified').length,
        fresh: unique.filter((signal) => signal.isFresh !== false).length,
        stale: unique.filter((signal) => signal.isFresh === false).length,
        categories: SIGNAL_CATEGORIES.reduce((counts, category) => ({ ...counts, [category]: unique.filter((signal) => signal.category === category).length }), {}),
        signals: unique,
      };
    },
    async createDecision({ ownerId, sourceIds, data = {}, signal = {}, context = {}, insight = '', priority = 'normal', priorityRationale = '', alert = null, assignment = null, action = null, geography = {}, createdBy = '', thresholds = {}, responseOptions = [] }) {
      const sources = [...new Set((Array.isArray(sourceIds) ? sourceIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
      const owner = String(ownerId || '').trim();
      if (!owner || !sources.length) throw new Error('An accountable owner and at least one source ID are required.');
      const ownerRecord = (await readOwners()).find((user) => user.id === owner && user.active !== false);
      if (!ownerRecord) throw new Error('The accountable owner does not exist or is inactive.');
      const resolvedSources = await resolveSources(sources);
      if (resolvedSources.some((source) => !source)) throw new Error('Every decision source ID must reference an existing signal, incident, task, or resource record.');
      if (!['low', 'normal', 'high', 'critical'].includes(priority)) throw new Error('Invalid decision priority.');
      if (priority !== 'normal' && !String(priorityRationale || '').trim()) throw new Error('A priority rationale is required for elevated decisions.');
      const now = new Date().toISOString();
      const explainableThresholds = { ...thresholds, evaluatedAt: now, basis: String(thresholds.basis || priorityRationale || 'No threshold basis supplied').trim() };
      const hotspot = geography?.lga || geography?.ward || geography?.pollingUnit || null;
      return saveDecision({
        id: randomUUID(),
        stage: 'proposed',
        approvalStatus: 'pending',
        autonomous: false,
        accountableOwnerId: owner,
        sourceIds: sources,
        data,
        signal,
        context,
        insight: String(insight || '').trim(),
        priority,
        priorityRationale: String(priorityRationale || '').trim(),
        thresholds: explainableThresholds,
        hotspot,
        responseOptions: Array.isArray(responseOptions) ? responseOptions : [],
        resolvedSources: resolvedSources.map((source) => ({ id: source.id || source.sourceEventId, type: source.sourceEventId ? 'signal' : source.kind ? 'resource' : source.reportType ? 'incident' : 'task' })),
        alert,
        assignment,
        action,
        geography,
        outcome: null,
        verification: null,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
    },
    async decisions({ ownerId, stage, geography = {} } = {}) {
      return (await readDecisions()).filter((decision) =>
        (!ownerId || decision.accountableOwnerId === ownerId) &&
        (!stage || decision.stage === stage) &&
        Object.entries(geography).every(([key, value]) => !value || decision.geography?.[key] === value),
      );
    },
    async approveDecision(id, { approvedBy = '' } = {}) {
      const decision = (await readDecisions()).find((item) => item.id === id);
      if (!decision) return null;
      const reviewer = String(approvedBy || '').trim();
      if (!reviewer) throw new Error('A human approver is required.');
      return saveDecision({ ...decision, stage: 'approved', approvalStatus: 'approved', approvedBy: reviewer, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },
    async updateDecision(id, { stage, assignment, action, verification, outcome, updatedBy = '' } = {}) {
      const decision = (await readDecisions()).find((item) => item.id === id);
      if (!decision) return null;
      const nextStage = String(stage || decision.stage).trim();
      if (!DECISION_STAGES.includes(nextStage)) throw new Error('Invalid decision workflow stage.');
      if (['assigned', 'actioned', 'verifying', 'completed'].includes(nextStage) && decision.approvalStatus !== 'approved') throw new Error('Human approval is required before assignment or action.');
      if (nextStage !== decision.stage && !LEGAL_TRANSITIONS.get(decision.stage)?.has(nextStage)) throw new Error(`Illegal decision transition from ${decision.stage} to ${nextStage}.`);
      if (nextStage === 'assigned' && (!assignment?.taskId || !(await this.taskExists(assignment.taskId)))) throw new Error('Assignment requires an existing linked task.');
      if (nextStage === 'actioned' && (!action?.evidenceId || !(await this.evidenceExists(action.evidenceId)))) throw new Error('Material action requires linked evidence.');
      if (nextStage === 'verifying' && (!verification?.verifiedBy || !verification?.evidenceId || !(await this.evidenceExists(verification.evidenceId)))) throw new Error('Verification requires an authorized verifier and existing evidence.');
      const mergedAssignment = assignment === undefined ? decision.assignment : assignment;
      const mergedAction = action === undefined ? decision.action : action;
      const mergedVerification = verification === undefined ? decision.verification : verification;
      const mergedOutcome = outcome === undefined ? decision.outcome : outcome;
      if (nextStage === 'completed' && (!mergedVerification?.evidenceId || !mergedOutcome?.status || !mergedAssignment?.taskId || !mergedAction?.evidenceId)) throw new Error('Completed decisions require linked assignment, action evidence, verification evidence, and an outcome status.');
      return saveDecision({ ...decision, stage: nextStage, assignment: mergedAssignment, action: mergedAction, verification: mergedVerification, outcome: mergedOutcome, updatedBy, updatedAt: new Date().toISOString() });
    },
    async taskExists(taskId) { return (await readSourceRecords()).tasks.some((task) => task.id === taskId); },
    async evidenceExists(evidenceId) {
      if (!evidenceId) return false;
      if (!pool) return Boolean(jsonDb.privateEvidence?.[`evidence:${evidenceId}`]);
      const { rows } = await pool.query('select value from app_settings where key=$1', [`evidence:${evidenceId}`]);
      return Boolean(rows[0]?.value);
    },
  };
}
