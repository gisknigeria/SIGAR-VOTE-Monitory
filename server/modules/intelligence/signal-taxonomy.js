export const SIGNAL_CATEGORIES = Object.freeze([
  'readiness',
  'presence',
  'polling-status',
  'queues',
  'materials',
  'logistics',
  'connectivity',
  'safety',
  'crm-issue',
  'rumour',
  'results',
  'intervention-status',
]);

export const SIGNAL_CONFIDENCE = Object.freeze(['unknown', 'low', 'medium', 'high']);
export const AUTHORIZED_SIGNAL_REVIEWERS = Object.freeze(['Supervisor', 'Admin', 'Super Admin']);

export const normalizeSignalCategory = (value, fallback = 'readiness') => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  return SIGNAL_CATEGORIES.includes(normalized) ? normalized : fallback;
};

export const normalizeSignalConfidence = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return SIGNAL_CONFIDENCE.includes(normalized) ? normalized : 'unknown';
};
