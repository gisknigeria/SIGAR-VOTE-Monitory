export const SYNC_RECORD_TYPES = ['incident', 'observation', 'result', 'task-ack'];

export class SyncConflictError extends Error {
  constructor({ submissionId, recordType, existingVersion = '', incomingVersion = '', existingRecordId = '' } = {}) {
    super(`Offline synchronization conflict for ${recordType || 'record'} '${submissionId || ''}'.`);
    this.name = 'SyncConflictError';
    this.code = 'SYNC_CONFLICT';
    this.status = 409;
    this.details = { submissionId, recordType, existingVersion, incomingVersion, existingRecordId, resolution: 'fetch-current-record-review-and-resubmit' };
  }
}

export function normalizeSyncEnvelope(input = {}, recordType) {
  const submissionId = String(input.submissionId || input.clientSubmissionId || '').trim();
  if (!submissionId) throw new Error('A client-generated submissionId is required for offline synchronization.');
  const captureTime = String(input.captureTime || input.deviceCapturedAt || input.createdAt || '').trim();
  if (!captureTime || !Number.isFinite(Date.parse(captureTime))) throw new Error('A valid device capture time is required for offline synchronization.');
  const recordVersion = String(input.recordVersion || input.version || '1').trim() || '1';
  return { submissionId, recordType: String(recordType || input.recordType || '').trim(), captureTime: new Date(captureTime).toISOString(), serverReceiptTime: new Date().toISOString(), recordVersion, payloadHash: String(input.payloadHash || '').trim(), attachmentIds: Array.isArray(input.attachmentIds) ? input.attachmentIds.map((id) => String(id).trim()).filter(Boolean) : [] };
}

export function syncConflictResponse(error) {
  return { code: error.code || 'SYNC_CONFLICT', message: error.message, conflict: error.details || null };
}
