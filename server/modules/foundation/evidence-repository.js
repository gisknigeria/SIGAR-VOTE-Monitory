import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createId } from '../../security.js';

const MAX_RETENTION_DAYS = 3650;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES = new Map([
  ['image/png', (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
  ['image/jpeg', (bytes) => bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))],
  ['image/webp', (bytes) => bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'],
  ['video/webm', (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))],
  ['video/mp4', (bytes) => bytes.subarray(4, 8).toString('ascii') === 'ftyp'],
]);
const dataUrlPattern = /^data:([^;]+);base64,([A-Za-z0-9+/]*={0,2})$/;
const scannerEndpoint = process.env.EVIDENCE_SCANNER_URL || '';
const storageRoot = process.env.EVIDENCE_STORAGE_DIR || join(process.cwd(), 'private-evidence');

const scannerFromEndpoint = async (bytes, mimeType) => {
  if (!scannerEndpoint) return { status: 'unavailable', scanner: 'configured-scanner-required' };
  const response = await fetch(scannerEndpoint, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-evidence-mime-type': mimeType }, body: bytes, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return { status: 'unavailable', scanner: `scanner-http-${response.status}` };
  const result = await response.json().catch(() => ({}));
  return { status: result.clean === true || result.status === 'clean' ? 'clean' : result.status === 'malicious' ? 'malicious' : 'unavailable', scanner: String(result.scanner || 'configured-scanner'), signature: result.signature || '' };
};

export function createEvidenceRepository({ pool, jsonDb, saveJson, scanner = scannerFromEndpoint, objectStore = null }) {
  const key = (id) => `evidence:${id}`;
  const readMetadata = async (id) => {
    if (!pool) { jsonDb.privateEvidence ||= {}; return jsonDb.privateEvidence[key(id)] || null; }
    const { rows } = await pool.query('select value from app_settings where key=$1', [key(id)]);
    return rows[0]?.value || null;
  };
  const saveMetadata = async (record) => {
    if (!pool) { jsonDb.privateEvidence ||= {}; jsonDb.privateEvidence[key(record.id)] = record; saveJson(); return record; }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key(record.id), JSON.stringify(record)]);
    return record;
  };
  const putObject = async (objectKey, bytes) => {
    if (objectStore) return objectStore.put(objectKey, bytes);
    await mkdir(storageRoot, { recursive: true });
    await writeFile(join(storageRoot, objectKey), bytes, { flag: 'wx' });
  };
  const getObject = (record) => objectStore ? objectStore.get(record.objectKey) : readFile(join(storageRoot, record.objectKey));
  const removeObject = async (record) => objectStore ? objectStore.delete(record.objectKey) : rm(join(storageRoot, record.objectKey), { force: true });
  const addCustody = (record, event, actorId, details = {}) => ({ ...record, custody: [...(record.custody || []), { event, actorId: String(actorId || 'system'), at: new Date().toISOString(), hash: record.hash, details }] });
  const denied = () => { const error = new Error('Evidence access is not permitted.'); error.code = 'EVIDENCE_ACCESS_DENIED'; return error; };
  const listAllMetadata = async () => {
    if (!pool) { jsonDb.privateEvidence ||= {}; return Object.values(jsonDb.privateEvidence); }
    return (await pool.query("select value from app_settings where key like 'evidence:%'")).rows.map((row) => row.value);
  };
  const deleteEvidenceRecord = async (id, actor = {}) => {
    const record = await readMetadata(id);
    if (!record) return null;
    if (!['Admin', 'Super Admin'].includes(actor.role) || record.retention?.legalHold) throw denied();
    const expired = record.retention?.expiresAt && new Date(record.retention.expiresAt).getTime() <= Date.now();
    if (!expired && actor.role !== 'Super Admin') throw new Error('Evidence may only be deleted after retention expires unless a Super Admin authorizes deletion.');
    await removeObject(record);
    return saveMetadata({ ...addCustody(record, 'deleted', actor.id, { authorizedRole: actor.role }), status: 'deleted', deletedAt: new Date().toISOString() });
  };

  return {
    async protectMediaPayload(media, { actorId = '', allowedUserIds = [], source = 'field-submission', retentionDays = 365, custodyEvent = 'captured', maxBytes = DEFAULT_MAX_BYTES, scanner: scan = scanner } = {}) {
      const retention = Math.min(MAX_RETENTION_DAYS, Math.max(1, Number(retentionDays) || 365));
      const expiresAt = new Date(Date.now() + retention * 86400000).toISOString();
      const refs = [];
      for (const item of Array.isArray(media) ? media : []) {
        const match = String(item?.data || '').match(dataUrlPattern);
        const mimeType = String(match?.[1] || '').toLowerCase();
        const signature = MEDIA_TYPES.get(mimeType);
        if (!match || !signature) throw new Error('Evidence media is malformed or unsupported.');
        const bytes = Buffer.from(match[2], 'base64');
        if (!bytes.length) throw new Error('Evidence media is empty.');
        if (bytes.length > maxBytes) throw new Error(`Evidence media exceeds the ${maxBytes}-byte size limit.`);
        if (!signature(bytes)) throw new Error('Evidence media content does not match its declared media type.');
        const hash = createHash('sha256').update(bytes).digest('hex');
        const id = createId('evidence');
        const now = new Date().toISOString();
        const scanResult = await scan(bytes, mimeType);
        const record = { id, objectKey: `${id}-${hash}`, hash, hashAlgorithm: 'sha256', mimeType, mediaType: item.type, byteLength: bytes.length, storage: 'private-object-store', access: [...new Set([actorId, ...allowedUserIds].filter(Boolean))], custody: [{ event: custodyEvent, actorId: String(actorId || 'system'), at: now, hash }], malwareScan: { ...scanResult, checkedAt: now }, status: scanResult.status === 'clean' ? 'available' : 'quarantined', retention: { policy: 'field-evidence-default', expiresAt, days: retention, legalHold: false }, source, createdAt: now };
        await saveMetadata(record);
        if (scanResult.status !== 'clean') throw new Error(`Evidence was quarantined because malware scanning returned ${scanResult.status}.`);
        await putObject(record.objectKey, bytes);
        refs.push({ id, type: item.type, mimeType, hash, hashAlgorithm: 'sha256', byteLength: bytes.length, storage: record.storage, malwareScan: record.malwareScan, retention: record.retention, custody: record.custody });
      }
      return refs;
    },
    async grantEvidenceAccess(id, { actorId = '', userIds = [], reason = 'reviewer reassignment' } = {}) {
      const record = await readMetadata(id);
      if (!record || !actorId) return null;
      return saveMetadata(addCustody({ ...record, access: [...new Set([...(record.access || []), ...userIds.filter(Boolean)])] }, 'access-granted', actorId, { userIds, reason }));
    },
    async setEvidenceLegalHold(id, { actor = {}, held = true, reason = '' } = {}) {
      const record = await readMetadata(id);
      if (!record || !['Admin', 'Super Admin'].includes(actor.role)) throw denied();
      return saveMetadata(addCustody({ ...record, retention: { ...record.retention, legalHold: Boolean(held), legalHoldReason: String(reason || '').trim() } }, held ? 'legal-hold-applied' : 'legal-hold-released', actor.id, { reason }));
    },
    async deleteEvidence(id, actor = {}) {
      return deleteEvidenceRecord(id, actor);
    },
    /**
     * Real, invokable retention enforcement -- not just a policy number. Deletes every
     * evidence record whose retention has expired, skipping (and reporting) anything
     * under legal hold. There is no automatic scheduler in this codebase; call this from
     * an operator-triggered endpoint or an external cron until one exists.
     */
    async sweepExpiredEvidence({ now = new Date().toISOString(), actorId = 'system' } = {}) {
      const records = await listAllMetadata();
      const nowTime = Date.parse(now);
      const expired = records.filter((record) => record.status !== 'deleted' && record.retention?.expiresAt && Date.parse(record.retention.expiresAt) <= nowTime);
      const deleted = [];
      const skippedLegalHold = [];
      for (const record of expired) {
        if (record.retention?.legalHold) { skippedLegalHold.push(record.id); continue; }
        await deleteEvidenceRecord(record.id, { id: actorId, role: 'Super Admin' });
        deleted.push(record.id);
      }
      return { evaluated: expired.length, deleted, skippedLegalHold, sweptAt: now };
    },
    /**
     * Metadata-only listing for cross-domain views (e.g. the geographic operational
     * view). Never returns evidence bytes or the full custody/access actor list, so it
     * is safe to include in a broader read that has not separately authorized viewing
     * the original media.
     */
    async evidenceSummaries(ids = []) {
      const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))];
      const records = await Promise.all(uniqueIds.map((id) => readMetadata(id)));
      return records.filter(Boolean).map((record) => ({
        id: record.id,
        mimeType: record.mimeType,
        mediaType: record.mediaType,
        byteLength: record.byteLength,
        status: record.status,
        malwareScanStatus: record.malwareScan?.status || 'unknown',
        retention: record.retention,
        source: record.source,
        createdAt: record.createdAt,
      }));
    },
    async readPrivateEvidence(id, actor = {}) {
      const record = await readMetadata(id);
      if (!record || record.status === 'deleted') return null;
      if (record.status !== 'available' || (!(record.access || []).includes(actor.id) && !['Admin', 'Super Admin'].includes(actor.role))) throw denied();
      const bytes = await getObject(record);
      if (createHash('sha256').update(bytes).digest('hex') !== record.hash) throw new Error('Evidence integrity check failed.');
      const updated = await saveMetadata(addCustody(record, 'accessed', actor.id));
      return { ...updated, originalData: `data:${record.mimeType};base64,${bytes.toString('base64')}` };
    },
  };
}
