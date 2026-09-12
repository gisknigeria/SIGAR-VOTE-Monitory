import { randomUUID } from 'node:crypto';

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
const keyOf = (record = {}) => ({
  electionId: String(record.electionId || record.provenance?.electionId || '').trim(),
  contestId: String(record.contestId || record.provenance?.contestId || record.contest || '').trim(),
  pollingUnit: String(record.pollingUnit || record.geography?.pollingUnit || '').trim(),
  sourceVersion: String(record.sourceVersion || record.provenance?.sourceVersion || record.sourceReleaseId || record.provenance?.sourceReleaseId || '').trim(),
});
const comparable = (record) => {
  if (typeof record === 'string') { try { return JSON.parse(record); } catch { return {}; } }
  return record || {};
};
const resultMap = (record) => Object.fromEntries(Object.entries(comparable(record)).map(([party, votes]) => [normalize(party), Number.isFinite(Number(votes)) ? Number(votes) : null]));
const resultMapFromPayload = (record) => {
  const value = comparable(record);
  if (Array.isArray(value)) return Object.fromEntries(value.map((entry) => [normalize(entry?.party || entry?.name), Number.isFinite(Number(entry?.votes)) ? Number(entry.votes) : null]).filter(([party]) => party));
  return resultMap(value);
};
const compareResults = (left, right) => {
  const a = resultMapFromPayload(left);
  const b = resultMapFromPayload(right);
  const parties = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return parties.filter((party) => a[party] !== b[party]).map((party) => ({ party, observed: a[party] ?? null, official: b[party] ?? null, reason: a[party] === null || b[party] === null ? 'missing-count-unknown' : 'vote-count-mismatch' }));
};

export function createReconciliationRepository({ pool, jsonDb, saveJson, mappers }) {
  const readResultRecords = async () => {
    if (!pool) return jsonDb.resultRecords || [];
    const rows = await pool.query('select * from result_records order by created_at desc');
    return rows.rows.map(mappers?.toResultRecord || ((row) => row));
  };
  const read = async (kind) => {
    if (!pool) { jsonDb[kind] ||= {}; return Object.values(jsonDb[kind]); }
    const rows = await pool.query('select value from app_settings where key like $1 order by key', [`${kind}:%`]);
    return rows.rows.map((row) => row.value);
  };
  const save = async (kind, value) => {
    if (!pool) { jsonDb[kind] ||= {}; jsonDb[kind][value.id] = value; saveJson(); return value; }
    const key = `${kind}:${value.id}`;
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key, JSON.stringify(value)]);
    return value;
  };
  return {
    async reconcileResults({ resultRecordIds = [], officialRecord, sourceClassification = 'authoritative-master', sourceReleaseId = '', reviewedBy = '' } = {}) {
      const records = (await readResultRecords()).filter((record) => resultRecordIds.includes(record.id));
      if (!records.length || !officialRecord) throw new Error('Result records and an official or reference record are required.');
      const keys = [officialRecord, ...records].map(keyOf);
      const [first] = keys;
      if (!first.electionId || !first.contestId || !first.pollingUnit || !first.sourceVersion) throw new Error('Reconciliation requires election, contest, polling unit, and source version.');
      if (keys.some((key) => key.electionId !== first.electionId || key.contestId !== first.contestId || normalize(key.pollingUnit) !== normalize(first.pollingUnit) || key.sourceVersion !== first.sourceVersion)) throw new Error('Only matching election, contest, polling unit, and source version may be reconciled.');
      const officialType = String(officialRecord.sourceType || '').toLowerCase();
      if (sourceClassification !== 'authoritative-master' || !sourceReleaseId || !['official-publication', 'ocr'].includes(officialType)) throw new Error('Official reconciliation requires an approved authoritative publication source release.');
      if (officialType === 'ocr' && !officialRecord.derivedFromEvidenceId) throw new Error('OCR transcriptions must retain their source evidence reference.');
      const discrepancies = records.flatMap((record) => compareResults(record.resultCount, officialRecord.resultCount).map((item) => ({ ...item, resultRecordId: record.id, submittedBy: record.submittedBy }))); 
      return save('resultReconciliations', { id: randomUUID(), ...first, resultRecordIds: records.map((record) => record.id), officialRecord: { ...officialRecord, sourceReleaseId, sourceClassification }, discrepancies, status: reviewedBy ? 'reviewed' : 'pending-review', reviewerId: reviewedBy, reviewerDecision: reviewedBy ? { decision: 'created', by: reviewedBy } : null, correctionId: '', createdAt: new Date().toISOString(), reviewedAt: reviewedBy ? new Date().toISOString() : null });
    },
    async resultReconciliations(filters = {}) { return (await read('resultReconciliations')).filter((item) => (!filters.status || item.status === filters.status) && (!filters.pollingUnit || normalize(item.pollingUnit) === normalize(filters.pollingUnit))); },
    async reviewReconciliation(id, { reviewerId = '', decision = '', reason = '', correctedResult = null } = {}) {
      const cases = await read('resultReconciliations');
      const item = cases.find((candidate) => candidate.id === id);
      if (!item) return null;
      const resultRecords = await readResultRecords();
      const submitters = item.resultRecordIds
        .map((recordId) => resultRecords.find((record) => record.id === recordId)?.submittedBy)
        .filter(Boolean);
      if (!reviewerId || submitters.includes(reviewerId)) throw new Error('Reviewer must be authenticated and independent of the submitting records.');
      if (!['accept-official', 'retain-provisional', 'reject-official', 'correct'].includes(decision)) throw new Error('Invalid reconciliation decision.');
      if (!String(reason || '').trim()) throw new Error('A reconciliation decision reason is required.');
      let correctionId = '';
      if (decision === 'correct') {
        if (!correctedResult || !Object.keys(correctedResult).length) throw new Error('A corrected result is required.');
        correctionId = randomUUID();
        await save('resultCorrections', { id: correctionId, reconciliationId: id, originalRecordIds: item.resultRecordIds, correctedResult, reason: String(reason).trim(), correctedBy: reviewerId, sourceClassification: 'field-observed', createdAt: new Date().toISOString() });
      }
      return save('resultReconciliations', { ...item, status: 'reviewed', reviewerId, reviewerDecision: { decision, reason: String(reason).trim() }, correctionId, reviewedAt: new Date().toISOString() });
    },
    async resultCorrections(reconciliationId = '') { return (await read('resultCorrections')).filter((item) => !reconciliationId || item.reconciliationId === reconciliationId); },
  };
}