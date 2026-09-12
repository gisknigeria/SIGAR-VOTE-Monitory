export const INCIDENT_STATUSES = [
  'reported',
  'triaged',
  'assigned',
  'acknowledged',
  'in progress',
  'verified',
  'resolved',
  'closed',
];

const LEGACY_STATUS_MAP = {
  Open: 'reported',
  Submitted: 'reported',
  'In Progress': 'in progress',
  Resolved: 'resolved',
};

const TRANSITIONS = new Map([
  ['reported', new Set(['triaged'])],
  ['triaged', new Set(['assigned'])],
  ['assigned', new Set(['acknowledged'])],
  ['acknowledged', new Set(['in progress'])],
  ['in progress', new Set(['verified', 'resolved'])],
  ['verified', new Set(['resolved', 'closed'])],
  ['resolved', new Set(['verified'])],
  ['closed', new Set()],
]);

export function normalizeIncidentStatus(status) {
  const value = String(status || '').trim();
  return LEGACY_STATUS_MAP[value] || value.toLowerCase();
}

export function canTransitionIncident(fromStatus, toStatus) {
  const from = normalizeIncidentStatus(fromStatus || 'reported');
  const to = normalizeIncidentStatus(toStatus);
  return INCIDENT_STATUSES.includes(from) && TRANSITIONS.get(from)?.has(to) === true;
}

export function hasVerificationEvidence(verificationEvidence) {
  return Array.isArray(verificationEvidence) && verificationEvidence.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const reference = String(item.id || item.referenceId || item.hash || '').trim();
    const type = String(item.type || item.kind || item.mediaType || '').trim();
    const source = String(item.source || item.provider || item.capturedBy || '').trim();
    const custody = Array.isArray(item.custody) && item.custody.length > 0;
    const scanPassed = item.malwareScan?.status === 'clean';
    return Boolean(reference && type && (source || custody || scanPassed));
  });
}

export function isIndependentReviewer({ reviewerId, incident }) {
  const id = String(reviewerId || '').trim();
  return Boolean(id && id !== incident.createdBy && id !== incident.assignedTo);
}

export function isAuthorizedReviewer(user) {
  return ['Admin', 'Super Admin', 'Supervisor'].includes(user?.role);
}

export function validateIncidentTransition({ incident, toStatus, actor, verificationEvidence = [] }) {
  const fromStatus = normalizeIncidentStatus(incident?.status || 'reported');
  const nextStatus = normalizeIncidentStatus(toStatus);
  if (!INCIDENT_STATUSES.includes(nextStatus)) {
    return { valid: false, message: `Invalid incident status. Use one of: ${INCIDENT_STATUSES.join(', ')}` };
  }
  if (!canTransitionIncident(fromStatus, nextStatus)) {
    return { valid: false, message: `Illegal incident transition from ${fromStatus} to ${nextStatus}` };
  }
  const evidence = verificationEvidence.length ? verificationEvidence : incident?.lifecycle?.verificationEvidence || incident?.verificationEvidence || [];
  const authorizedReviewer = isAuthorizedReviewer(actor) && isIndependentReviewer({ reviewerId: actor?.id, incident });
  if (nextStatus === 'verified') {
    if (!authorizedReviewer) return { valid: false, message: 'Only an authorized reviewer who is independent of the reporter and responder may verify an incident.' };
    if (!hasVerificationEvidence(evidence)) return { valid: false, message: 'Meaningful structured verification evidence is required before an incident can be verified.' };
  }
  if (nextStatus === 'closed') {
    if (!incident?.lifecycle?.verifiedBy || !incident?.lifecycle?.verifiedAt || !hasVerificationEvidence(evidence)) {
      return { valid: false, message: 'An incident must complete an authorized verified transition with meaningful evidence before it can be closed.' };
    }
    if (!authorizedReviewer) return { valid: false, message: 'Only an authorized independent reviewer may close a verified incident.' };
  }
  return { valid: true, fromStatus, nextStatus };
}
