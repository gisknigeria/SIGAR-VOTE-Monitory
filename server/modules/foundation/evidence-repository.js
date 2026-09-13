import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connect } from 'node:net';
import { createId } from '../../security.js';

const MAX_RETENTION_DAYS = 3650;
const DEFAULT_MAX_BYTES = 40 * 1024 * 1024;
const isftyp = (bytes) => bytes.length > 8 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
const isZipContainer = (bytes) => bytes.subarray(0, 2).toString('ascii') === 'PK';
const isOleContainer = (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
const MEDIA_TYPES = new Map([
  ['image/png', (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
  ['image/jpeg', (bytes) => bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))],
  ['image/webp', (bytes) => bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'],
  ['image/gif', (bytes) => bytes.subarray(0, 3).toString('ascii') === 'GIF'],
  ['image/heic', isftyp],
  ['image/heif', isftyp],
  ['video/webm', (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))],
  ['video/mp4', isftyp],
  ['video/quicktime', isftyp],
  ['video/3gpp', isftyp],
  ['video/3gpp2', isftyp],
  ['video/x-msvideo', (bytes) => bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 11).toString('ascii') === 'AVI'],
  ['application/pdf', (bytes) => bytes.subarray(0, 4).toString('ascii') === '%PDF'],
  ['application/msword', isOleContainer],
  ['application/vnd.ms-excel', isOleContainer],
  ['application/vnd.ms-powerpoint', isOleContainer],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', isZipContainer],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', isZipContainer],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', isZipContainer],
  ['text/plain', (bytes) => bytes.length > 0],
  ['text/csv', (bytes) => bytes.length > 0],
]);
const dataUrlPattern = /^data:([^;]+);base64,([A-Za-z0-9+/]*={0,2})$/;
const scannerEndpoint = process.env.EVIDENCE_SCANNER_URL || '';
const clamdHost = process.env.CLAMD_HOST || '';
const clamdPort = Number(process.env.CLAMD_PORT || 3310);
/**
 * Temporary escape hatch for standing up the app before a real scanner is
 * connected. Only ever bypasses an UNAVAILABLE scanner -- a result the
 * scanner actually flags as malicious is never let through. Every bypass is
 * logged loudly and the evidence record itself is marked unscanned (never
 * faked as "clean"), so the gap stays visible in server logs and in the
 * evidence's own audit trail rather than being silently hidden.
 */
const allowUnscannedEvidence = process.env.ALLOW_UNSCANNED_EVIDENCE === 'true';
const storageRoot = process.env.EVIDENCE_STORAGE_DIR || join(process.cwd(), 'private-evidence');

const scannerFromEndpoint = async (bytes, mimeType) => {
  if (!scannerEndpoint) return { status: 'unavailable', scanner: 'configured-scanner-required' };
  const response = await fetch(scannerEndpoint, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-evidence-mime-type': mimeType }, body: bytes, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return { status: 'unavailable', scanner: `scanner-http-${response.status}` };
  const result = await response.json().catch(() => ({}));
  return { status: result.clean === true || result.status === 'clean' ? 'clean' : result.status === 'malicious' ? 'malicious' : 'unavailable', scanner: String(result.scanner || 'configured-scanner'), signature: result.signature || '' };
};

/**
 * Scans bytes with a real ClamAV daemon over its INSTREAM protocol
 * (https://docs.clamav.net/manual/Usage/Scanning.html#stream-scanning) --
 * clamd is free, open-source, and needs no API key or account, just a
 * reachable daemon (e.g. the official `clamav/clamav-daemon` container).
 * Chosen over the HTTP scanner when CLAMD_HOST is set.
 */
export const scannerFromClamd = (bytes, _mimeType, { host = clamdHost, port = clamdPort } = {}) => new Promise((resolve) => {
  const socket = connect({ host, port, timeout: 15_000 });
  let response = '';
  const finish = (result) => { socket.destroy(); resolve(result); };
  socket.on('timeout', () => finish({ status: 'unavailable', scanner: 'clamd-timeout' }));
  socket.on('error', (error) => finish({ status: 'unavailable', scanner: `clamd-error-${error.code || 'unknown'}` }));
  socket.on('data', (chunk) => { response += chunk.toString('utf8'); });
  socket.on('close', () => {
    if (!response) return;
    // clamd's z-prefixed protocol null-terminates its reply; strip that before matching end-of-string.
    const trimmed = response.replace(/\0+$/, '').trim();
    if (/:\s*OK$/.test(trimmed)) return finish({ status: 'clean', scanner: 'clamd' });
    const match = trimmed.match(/:\s*(.+?)\s+FOUND/);
    if (match) return finish({ status: 'malicious', scanner: 'clamd', signature: match[1] });
    finish({ status: 'unavailable', scanner: 'clamd-unrecognized-response' });
  });
  socket.on('connect', () => {
    socket.write('zINSTREAM\0');
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      const sizeHeader = Buffer.alloc(4);
      sizeHeader.writeUInt32BE(chunk.length, 0);
      socket.write(sizeHeader);
      socket.write(chunk);
    }
    socket.write(Buffer.from([0, 0, 0, 0]));
  });
});

const defaultScanner = clamdHost ? scannerFromClamd : scannerFromEndpoint;

export function createEvidenceRepository({ pool, jsonDb, saveJson, scanner = defaultScanner, objectStore = null }) {
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
    async protectMediaPayload(media, { actorId = '', allowedUserIds = [], source = 'field-submission', retentionDays = 365, custodyEvent = 'captured', maxBytes = DEFAULT_MAX_BYTES, scanner: scan = scanner, allowUnscannedEvidence: allowBypass = allowUnscannedEvidence } = {}) {
      const retention = Math.min(MAX_RETENTION_DAYS, Math.max(1, Number(retentionDays) || 365));
      const expiresAt = new Date(Date.now() + retention * 86400000).toISOString();
      const refs = [];
      for (const item of Array.isArray(media) ? media : []) {
        if (item?.type === 'livestream') {
          if (!item.userId) throw new Error('Live stream attachment is missing its source.');
          refs.push({ id: createId('evidence'), type: 'livestream', userId: String(item.userId), name: item.name || 'Live camera stream' });
          continue;
        }
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
        const bypassed = scanResult.status === 'unavailable' && allowBypass;
        if (bypassed) console.warn(`[evidence] ALLOW_UNSCANNED_EVIDENCE is enabled: accepting ${id} (${mimeType}, ${bytes.length} bytes) from actor ${actorId || 'unknown'} WITHOUT malware scanning. This is a temporary bypass -- connect a real scanner (CLAMD_HOST or EVIDENCE_SCANNER_URL) as soon as possible.`);
        const accepted = scanResult.status === 'clean' || bypassed;
        const custody = [{ event: custodyEvent, actorId: String(actorId || 'system'), at: now, hash }];
        if (bypassed) custody.push({ event: 'accepted-without-malware-scan', actorId: 'system', at: now, hash, details: { reason: 'ALLOW_UNSCANNED_EVIDENCE enabled while scanner unavailable' } });
        const record = { id, objectKey: `${id}-${hash}`, hash, hashAlgorithm: 'sha256', mimeType, mediaType: item.type, byteLength: bytes.length, storage: 'private-object-store', access: [...new Set([actorId, ...allowedUserIds].filter(Boolean))], custody, malwareScan: { ...scanResult, checkedAt: now, bypassed }, status: accepted ? 'available' : 'quarantined', retention: { policy: 'field-evidence-default', expiresAt, days: retention, legalHold: false }, source, createdAt: now };
        await saveMetadata(record);
        if (!accepted) throw new Error(`Evidence was quarantined because malware scanning returned ${scanResult.status}.`);
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
