import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, matchesGeography } from '../foundation/geography-query.js';

export class ResultSubmissionConflictError extends Error {
  constructor() {
    super('Submission conflict: this submission ID has already been used with different payload content or ownership.');
    this.code = 'RESULT_SUBMISSION_CONFLICT';
    this.status = 409;
  }
}

const sameSubmission = (record, candidate) =>
  String(record.payloadHash || '').toLowerCase() === String(candidate.payloadHash || '').toLowerCase() &&
  String(record.submittedBy || '') === String(candidate.submittedBy || '');

export function createResultsRepository({ pool, jsonDb, saveJson, mappers }) {
  const toResultRecord = mappers?.toResultRecord || ((record) => record);

  return {
    async resultRecords() {
      if (!pool) return jsonDb.resultRecords || [];
      const { rows } = await pool.query('select * from result_records order by created_at desc');
      return rows.map(toResultRecord);
    },

    /** Bounded, geography-scoped read for cross-domain views; see incidentsPage for the same contract. */
    async resultRecordsPage({ lga = '', ward = '', pollingUnit = '', limit = DEFAULT_PAGE_LIMIT, offset = 0 } = {}) {
      const boundedLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(limit) || DEFAULT_PAGE_LIMIT));
      const boundedOffset = Math.max(0, Number(offset) || 0);
      if (!pool) {
        const filtered = (jsonDb.resultRecords || []).filter((record) => matchesGeography(record, { lga, ward, pollingUnit }));
        return { items: filtered.slice(boundedOffset, boundedOffset + boundedLimit), total: filtered.length, limit: boundedLimit, offset: boundedOffset };
      }
      const conditions = [];
      const values = [];
      if (lga) { values.push(lga); conditions.push(`lga = $${values.length}`); }
      if (ward) { values.push(ward); conditions.push(`ward = $${values.length}`); }
      if (pollingUnit) { values.push(pollingUnit); conditions.push(`polling_unit = $${values.length}`); }
      const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
      const countResult = await pool.query(`select count(*)::int as count from result_records ${where}`, values);
      values.push(boundedLimit, boundedOffset);
      const { rows } = await pool.query(`select * from result_records ${where} order by created_at desc limit $${values.length - 1} offset $${values.length}`, values);
      return { items: rows.map(toResultRecord), total: countResult.rows[0]?.count ?? 0, limit: boundedLimit, offset: boundedOffset };
    },

    async createResultRecord(record, { returnMetadata = false } = {}) {
      if (!pool) {
        jsonDb.resultRecords ||= [];
        const existing = jsonDb.resultRecords.find((item) => item.submissionId === record.submissionId);
        if (existing) {
          if (!sameSubmission(existing, record)) throw new ResultSubmissionConflictError();
          return returnMetadata ? { record: existing, created: false } : existing;
        }
        jsonDb.resultRecords.unshift(record);
        saveJson();
        return returnMetadata ? { record, created: true } : record;
      }

      const { rows } = await pool.query(
        'insert into result_records (id,submission_id,payload_hash,election_id,scope_id,source_release_id,result_id,geography,provenance,state,lga,ward,polling_unit,result_source,submitted_by,submitted_by_role,result_count,evidence,created_at,updated_at,capture_time,server_receipt_at,record_version) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) on conflict (submission_id) do nothing returning *',
        [
          record.id,
          record.submissionId,
          record.payloadHash,
          record.electionId,
          record.scopeId,
          record.sourceReleaseId || record.provenance?.sourceReleaseId || '',
          record.resultId || '',
          JSON.stringify(record.geography || null),
          JSON.stringify(record.provenance || null),
          record.state || '',
          record.lga || '',
          record.ward || '',
          record.pollingUnit || '',
          record.resultSource || '',
          record.submittedBy || '',
          record.submittedByRole || '',
          record.resultCount || '',
          JSON.stringify(record.evidence || []),
          record.createdAt,
          record.updatedAt || record.createdAt,
          record.captureTime || record.createdAt,
          record.serverReceiptTime || record.createdAt,
          record.recordVersion || '1',
        ],
      );
      if (rows[0]) {
        const createdRecord = toResultRecord(rows[0]);
        return returnMetadata ? { record: createdRecord, created: true } : createdRecord;
      }
      const existingResult = await pool.query('select * from result_records where submission_id=$1', [record.submissionId]);
      const existing = existingResult.rows[0] ? toResultRecord(existingResult.rows[0]) : null;
      if (!existing) throw new Error('Result submission could not be read after a duplicate write.');
      if (!sameSubmission(existing, record)) throw new ResultSubmissionConflictError();
      return returnMetadata ? { record: existing, created: false } : existing;
    },
  };
}