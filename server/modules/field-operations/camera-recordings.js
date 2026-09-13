import { randomUUID } from 'node:crypto';

// Base64 inflates raw bytes by ~1.33x, and this rides the existing global JSON
// body limit (server/middleware/http.js, MAX_REQUEST_BODY_BYTES in security.js)
// rather than widening it just for this route -- 40MB raw stays safely under
// that after encoding overhead.
export const MAX_RECORDING_BYTES = 40 * 1024 * 1024;
const key = (id) => `camera-recording:${id}`;

/**
 * Auto-saved camera-share recordings. This intentionally reuses the same
 * hardened evidence storage (malware scan, hash, retention, access control)
 * as field-submitted photo evidence rather than a separate media pipeline --
 * the dedicated media-server (media-server/index.js) is the eventual home for
 * long-duration/chunked recordings once it has a deployed URL and real object
 * storage; until then this keeps auto-save reliable without new infrastructure.
 * The evidence bytes themselves are protected by the caller via
 * store.protectMediaPayload() first -- this repository only indexes the
 * resulting reference by geography so recordings can later be browsed grouped
 * by location alongside photo evidence.
 */
export function createCameraRecordingsRepository({ pool, jsonDb, saveJson }) {
  const save = async (record) => {
    if (!pool) { jsonDb.cameraRecordings ||= {}; jsonDb.cameraRecordings[key(record.id)] = record; saveJson(); return record; }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key(record.id), JSON.stringify(record)]);
    return record;
  };
  const readAll = async () => {
    if (!pool) { jsonDb.cameraRecordings ||= {}; return Object.values(jsonDb.cameraRecordings); }
    return (await pool.query("select value from app_settings where key like 'camera-recording:%' order by key desc")).rows.map((row) => row.value);
  };
  return {
    async saveCameraRecording({ actor, evidenceRef, startedAt, endedAt, geography = {} }) {
      if (!actor?.id) throw new Error('An authenticated actor is required.');
      if (!evidenceRef?.id) throw new Error('A protected evidence reference is required.');
      const record = {
        id: randomUUID(),
        evidenceId: evidenceRef.id,
        submittedBy: actor.id,
        submittedByRole: actor.role || '',
        submittedByName: actor.name || '',
        geography: { state: geography.state || 'Oyo', lga: geography.lga || '', ward: geography.ward || '', pollingUnit: geography.pollingUnit || '', station: geography.station || '' },
        mimeType: evidenceRef.mimeType || '',
        byteLength: evidenceRef.byteLength,
        startedAt: startedAt || null,
        endedAt: endedAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      return save(record);
    },
    /** Grouped by each recording's geography, for a future media-library view. */
    async cameraRecordings({ lga, ward, pollingUnit } = {}) {
      const records = await readAll();
      return records
        .filter((record) => (!lga || record.geography.lga === lga) && (!ward || record.geography.ward === ward) && (!pollingUnit || record.geography.pollingUnit === pollingUnit))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
