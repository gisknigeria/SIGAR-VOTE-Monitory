
import { normalizeIncidentStatus, validateIncidentTransition } from './lifecycle.js';
import { SyncConflictError } from '../foundation/sync-contract.js';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, matchesGeography, paginate } from '../foundation/geography-query.js';

export function createIncidentsRepository({ pool, jsonDb, saveJson, mappers }) {
  const { toIncident } = mappers;
  return {
    async incidents() {
      if (!pool) return jsonDb.incidents;
      const { rows } = await pool.query('select * from incidents order by created_at desc');
      return rows.map(toIncident);
    },
    /**
     * Bounded, geography-scoped read used by cross-domain views (e.g. the geographic
     * operational view) that must not load an unbounded incident table into memory.
     * Runs a real SQL WHERE/LIMIT/OFFSET against Postgres; falls back to an in-memory
     * filter+slice against the JSON store.
     */
    async incidentsPage({ lga = '', ward = '', pollingUnit = '', limit = DEFAULT_PAGE_LIMIT, offset = 0 } = {}) {
      const boundedLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(limit) || DEFAULT_PAGE_LIMIT));
      const boundedOffset = Math.max(0, Number(offset) || 0);
      if (!pool) {
        const filtered = jsonDb.incidents.filter((incident) => matchesGeography(incident, { lga, ward, pollingUnit }));
        return { items: filtered.slice(boundedOffset, boundedOffset + boundedLimit), total: filtered.length, limit: boundedLimit, offset: boundedOffset };
      }
      const conditions = [];
      const values = [];
      if (lga) { values.push(lga); conditions.push(`lga = $${values.length}`); }
      if (ward) { values.push(ward); conditions.push(`ward = $${values.length}`); }
      if (pollingUnit) { values.push(pollingUnit); conditions.push(`polling_unit = $${values.length}`); }
      const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
      const countResult = await pool.query(`select count(*)::int as count from incidents ${where}`, values);
      values.push(boundedLimit, boundedOffset);
      const { rows } = await pool.query(`select * from incidents ${where} order by created_at desc limit $${values.length - 1} offset $${values.length}`, values);
      return { items: rows.map(toIncident), total: countResult.rows[0]?.count ?? 0, limit: boundedLimit, offset: boundedOffset };
    },
    async createIncident(incident) {
      const now = new Date().toISOString();
      const existingSubmission = incident.submissionId && (await this.incidents()).find((item) => item.submissionId === incident.submissionId);
      if (existingSubmission) {
        if (existingSubmission.payloadHash === incident.payloadHash) return existingSubmission;
        throw new SyncConflictError({ submissionId: incident.submissionId, recordType: 'incident', existingVersion: existingSubmission.recordVersion, incomingVersion: incident.recordVersion, existingRecordId: existingSubmission.id });
      }
      const lifecycle = {
        deadlineAt: incident.deadlineAt || null,
        ownerId: incident.ownerId || incident.assignedTo || '',
        escalationLevel: Number(incident.escalationLevel || 0),
        transitionHistory: incident.transitionHistory || [{
          from: null,
          to: normalizeIncidentStatus(incident.status || 'reported'),
          actorId: incident.createdBy || '',
          at: incident.createdAt || now,
          reason: 'incident reported',
        }],
        verificationEvidence: incident.verificationEvidence || [],
        verifiedBy: incident.verifiedBy || '',
        verifiedAt: incident.verifiedAt || null,
      };
        incident = { ...incident, status: normalizeIncidentStatus(incident.status || 'reported'), lifecycle };
      if (!pool) { jsonDb.incidents.unshift(incident); saveJson(); return incident; }
        const { rows } = await pool.query('insert into incidents (id,title,description,report_type,severity,status,lat,lng,assigned_to,visible_to,media,geometry,style,lga,ward,polling_unit,result_count,lifecycle,created_at,created_by,submission_id,capture_time,server_receipt_at,record_version) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) returning *', [incident.id, incident.title, incident.description, incident.reportType, incident.severity, incident.status, incident.lat, incident.lng, incident.assignedTo, JSON.stringify(incident.visibleTo || []), JSON.stringify(incident.media || []), JSON.stringify(incident.geometry || null), JSON.stringify(incident.style || null), incident.lga || '', incident.ward || '', incident.pollingUnit || '', incident.resultCount || '', JSON.stringify(lifecycle), incident.createdAt, incident.createdBy, incident.submissionId || '', incident.captureTime || null, incident.serverReceiptTime || now, incident.recordVersion || '1']);
      return toIncident(rows[0]);
    },
    async transitionIncident(id, toStatus, { actor, deadlineAt, ownerId, escalationLevel, verificationEvidence = [], reason = '' } = {}) {
      const current = (await this.incidents()).find((incident) => incident.id === id);
      if (!current) return null;
      const validation = validateIncidentTransition({ incident: current, toStatus, actor, verificationEvidence });
      if (!validation.valid) {
        const error = new Error(validation.message);
        error.code = 'INVALID_INCIDENT_TRANSITION';
        throw error;
      }
      const now = new Date().toISOString();
      const currentLifecycle = current.lifecycle || {};
      const lifecycle = {
        ...currentLifecycle,
        deadlineAt: deadlineAt === undefined ? currentLifecycle.deadlineAt || null : deadlineAt,
        ownerId: ownerId === undefined ? currentLifecycle.ownerId || current.assignedTo || '' : ownerId,
        escalationLevel: escalationLevel === undefined ? Number(currentLifecycle.escalationLevel || 0) : Number(escalationLevel),
        verificationEvidence: verificationEvidence.length ? verificationEvidence : currentLifecycle.verificationEvidence || [],
        verifiedBy: validation.nextStatus === 'verified' || validation.nextStatus === 'closed' ? actor.id : currentLifecycle.verifiedBy || '',
        verifiedAt: validation.nextStatus === 'verified' || validation.nextStatus === 'closed' ? now : currentLifecycle.verifiedAt || null,
        transitionHistory: [
          ...(currentLifecycle.transitionHistory || []),
          { from: validation.fromStatus, to: validation.nextStatus, actorId: actor.id, at: now, reason: String(reason || '').trim() },
        ],
      };
      return this.updateIncident(id, { status: validation.nextStatus, lifecycle });
    },
    async updateIncident(id, patch) {
      if (!pool) {
        const index = jsonDb.incidents.findIndex(incident => incident.id === id);
        if (index < 0) return null;
        jsonDb.incidents[index] = { ...jsonDb.incidents[index], ...patch, id, updatedAt: new Date().toISOString() };
        saveJson();
        return jsonDb.incidents[index];
      }
      const current = await pool.query('select * from incidents where id=$1', [id]);
      if (!current.rows[0]) return null;
      const merged = { ...toIncident(current.rows[0]), ...patch, id, updatedAt: new Date().toISOString() };
        const { rows } = await pool.query('update incidents set title=$2, description=$3, report_type=$4, severity=$5, status=$6, lat=$7, lng=$8, assigned_to=$9, visible_to=$10, media=$11, geometry=$12, style=$13, lifecycle=$14, updated_at=$15 where id=$1 returning *', [id, merged.title, merged.description, merged.reportType, merged.severity, merged.status, merged.lat, merged.lng, merged.assignedTo, JSON.stringify(merged.visibleTo || []), JSON.stringify(merged.media || []), JSON.stringify(merged.geometry || null), JSON.stringify(merged.style || null), JSON.stringify(merged.lifecycle || {}), merged.updatedAt]);
      return toIncident(rows[0]);
    },
    async deleteIncident(id) {
      if (!pool) { jsonDb.incidents = jsonDb.incidents.filter(incident => incident.id !== id); saveJson(); return; }
      await pool.query('delete from incidents where id=$1', [id]);
    },
  };
}
