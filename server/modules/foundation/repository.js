
import { createHash } from 'node:crypto';
import { deployment, getDeploymentConfig } from '../../config/deployment.js';
import { normalizeSourceClassification, SOURCE_CLASSIFICATIONS } from './provenance.js';
import { paginate } from './geography-query.js';

const resolveScopeId = (value = deployment.scopeId) => String(value || getDeploymentConfig().scopeId || 'ng-oyo').trim() || 'ng-oyo';
const resolveElectionId = (value = deployment.electionId) => String(value || getDeploymentConfig().electionId || 'ng-oyo-election').trim() || 'ng-oyo-election';
const resolveSourceVersion = (value = deployment.sourceVersion) => String(value || getDeploymentConfig().sourceVersion || 'oyo-operational-v1').trim() || 'oyo-operational-v1';
const validateElectionReference = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || !/^[a-z0-9][a-z0-9._:-]*$/i.test(normalized)) {
    throw new Error('Election references must be a validated non-empty identifier.');
  }
  return normalized;
};

export function createFoundationRepository({ pool, jsonDb, saveJson, mappers }) {
  const stableStringify = (value) => {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    if (typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(String(value));
  };

  const canonicalGeography = ({ country = 'Nigeria', state = 'Oyo', lga = '', ward = '', pollingUnit = '', scopeId = deployment.scopeId } = {}) => {
    const resolvedState = String(state || 'Oyo').trim() || 'Oyo';
    const resolvedLga = String(lga || '').trim();
    const resolvedWard = String(ward || '').trim();
    const resolvedPollingUnit = String(pollingUnit || '').trim();
    const resolvedScopeId = resolveScopeId(scopeId);

    return {
      country: String(country || 'Nigeria').trim() || 'Nigeria',
      state: resolvedState,
      lga: resolvedLga,
      ward: resolvedWard,
      pollingUnit: resolvedPollingUnit,
      hierarchy: [
        'Nigeria',
        resolvedState,
        ...(resolvedLga ? [resolvedLga] : []),
        ...(resolvedWard ? [resolvedWard] : []),
        ...(resolvedPollingUnit ? [resolvedPollingUnit] : []),
      ],
      level: resolvedPollingUnit ? 'polling-unit' : resolvedWard ? 'ward' : resolvedLga ? 'lga' : 'state',
      canonicalId: [
        'ng',
        resolvedState.toLowerCase(),
        ...(resolvedLga ? [resolvedLga.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : []),
        ...(resolvedWard ? [resolvedWard.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : []),
        ...(resolvedPollingUnit ? [resolvedPollingUnit.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : []),
      ].filter(Boolean).join('-') || `ng-${resolvedState.toLowerCase()}`,
      scopeId: resolvedScopeId,
      sourceVersion: resolveSourceVersion(),
      sourceClassification: 'external-reference',
      dataStatus: 'unverified',
      isCanonical: true,
    };
  };

  const sourceProvenance = ({
    classification = 'field-observed',
    source = 'manual-submission',
    recordedBy = '',
    recordedAt = new Date().toISOString(),
    verificationStatus = 'unverified',
    electionId = deployment.electionId,
    sourceVersion = deployment.sourceVersion,
    sourceType,
    scopeId = deployment.scopeId,
    sourceReleaseId = '',
  } = {}) => {
    const normalizedClassification = normalizeSourceClassification(classification);
    const resolvedScopeId = resolveScopeId(scopeId);
    const resolvedElectionId = validateElectionReference(electionId || resolveElectionId());
    return {
      classification: normalizedClassification,
      sourceType: sourceType || normalizedClassification,
      source: String(source || 'manual-submission').trim() || 'manual-submission',
      sourceVersion: String(sourceVersion || resolveSourceVersion()),
      scopeId: resolvedScopeId,
      electionId: resolvedElectionId,
      sourceReleaseId: String(sourceReleaseId || '').trim(),
      recordedBy: String(recordedBy || '').trim(),
      recordedAt: String(recordedAt || new Date().toISOString()),
      verificationStatus: String(verificationStatus || 'unverified').trim() || 'unverified',
      isAuthoritative: normalizedClassification === 'authoritative-master',
      acceptedBy: '',
    };
  };

  const createAuditEntry = ({ actorId = '', actorRole = '', action = '', entityType = 'record', entityId = '', details = {}, source = 'system', scopeId = deployment.scopeId, geography = null, status = 'logged' } = {}) => ({
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    actorId: String(actorId || '').trim(),
    actorRole: String(actorRole || '').trim(),
    action: String(action || '').trim(),
    entityType: String(entityType || 'record').trim(),
    entityId: String(entityId || '').trim(),
    source: String(source || 'system').trim(),
    scopeId: resolveScopeId(scopeId),
    status: String(status || 'logged').trim(),
    geography: geography || null,
    details: details || {},
  });

  const hashPayload = (payload) => createHash('sha256').update(stableStringify(payload)).digest('hex');

  const getFieldSubmission = async (submissionId) => {
    const normalizedId = String(submissionId || '').trim();
    if (!normalizedId) return null;
    const key = `field-submission:${normalizedId}`;
    if (!pool) {
      jsonDb.fieldSubmissions ||= {};
      return jsonDb.fieldSubmissions[key] || null;
    }
    const { rows } = await pool.query('select value from app_settings where key = $1', [key]);
    return rows[0]?.value ?? null;
  };

  const saveFieldSubmission = async (submission) => {
    const id = String(submission?.submissionId || '').trim();
    if (!id) return submission;
    const key = `field-submission:${id}`;
    if (!pool) {
      jsonDb.fieldSubmissions ||= {};
      jsonDb.fieldSubmissions[key] = submission;
      saveJson();
      return submission;
    }
    await pool.query(
      'insert into app_settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value',
      [key, JSON.stringify(submission)],
    );
    return submission;
  };

  const appendAuditEntry = async (entry) => {
    if (!entry || !entry.action) return null;
    if (!pool) {
      jsonDb.auditEntries ||= [];
      jsonDb.auditEntries.unshift(entry);
      saveJson();
      return entry;
    }
    const { rows } = await pool.query(
      'insert into audit_events (id,actor_id,actor_role,action,entity_type,entity_id,source,scope_id,status,geography,details,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *',
      [
        entry.id,
        entry.actorId || '',
        entry.actorRole || '',
        entry.action,
        entry.entityType || 'record',
        entry.entityId || '',
        entry.source || 'system',
        entry.scopeId || 'ng-oyo',
        entry.status || 'logged',
        JSON.stringify(entry.geography || null),
        JSON.stringify(entry.details || {}),
        entry.createdAt,
      ],
    );
    return rows[0] ? {
      ...entry,
      geography: rows[0].geography || entry.geography || null,
      details: rows[0].details || entry.details || {},
    } : entry;
  };

  // Read-only by design: no update/delete method is exposed for audit events, so an
  // ordinary application code path cannot alter or remove one once appended. Real
  // immutability against a direct database connection additionally requires the
  // BEFORE UPDATE/DELETE trigger added in infrastructure/persistence/bootstrap.js.
  const auditEvents = async ({ actorId, entityType, entityId, action, since, until, limit, offset } = {}) => {
    const rows = !pool
      ? (jsonDb.auditEntries || [])
      : (await pool.query('select * from audit_events order by created_at desc')).rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at?.toISOString?.() || row.created_at,
          actorId: row.actor_id || '',
          actorRole: row.actor_role || '',
          action: row.action,
          entityType: row.entity_type || 'record',
          entityId: row.entity_id || '',
          source: row.source || 'system',
          scopeId: row.scope_id || 'ng-oyo',
          status: row.status || 'logged',
          geography: row.geography || null,
          details: row.details || {},
        }));
    const sinceTime = since ? Date.parse(since) : null;
    const untilTime = until ? Date.parse(until) : null;
    const filtered = rows.filter((entry) => {
      const time = Date.parse(entry.createdAt || '');
      return (!actorId || entry.actorId === actorId) &&
        (!entityType || entry.entityType === entityType) &&
        (!entityId || entry.entityId === entityId) &&
        (!action || entry.action === action) &&
        (!sinceTime || (Number.isFinite(time) && time >= sinceTime)) &&
        (!untilTime || (Number.isFinite(time) && time < untilTime));
    });
    return paginate(filtered, { limit, offset });
  };

  return {
    sourceClassifications: SOURCE_CLASSIFICATIONS,
    canonicalOyoVersion: resolveSourceVersion(),
    canonicalOyoElectionId: resolveElectionId(),
    canonicalGeography,
    sourceProvenance,
    hashPayload,
    getFieldSubmission,
    saveFieldSubmission,
    createAuditEntry,
    appendAuditEntry,
    auditEvents,
    async setting(key, fallback = null) {
      if (!pool) return Object.prototype.hasOwnProperty.call(jsonDb.settings || {}, key) ? jsonDb.settings[key] : fallback;
      const { rows } = await pool.query('select value from app_settings where key=$1', [key]);
      return rows[0]?.value ?? fallback;
    },
    async setSetting(key, value) {
      if (!pool) { jsonDb.settings ||= {}; jsonDb.settings[key] = value; saveJson(); return value; }
      await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key, JSON.stringify(value)]);
      return value;
    },
    async parties() {
      if (!pool) return jsonDb.parties || [];
      const { rows } = await pool.query("select value from app_settings where key='political_parties'");
      return rows[0]?.value || [];
    },
    async setParties(parties) {
      if (!pool) { jsonDb.parties = parties; saveJson(); return parties; }
      await pool.query("insert into app_settings (key,value) values ('political_parties',$1) on conflict (key) do update set value=excluded.value", [JSON.stringify(parties)]);
      return parties;
    },
  };
}
